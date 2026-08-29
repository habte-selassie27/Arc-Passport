/**
 * POST /passport/:address/activate
 *
 * Activates a passport after identity registration:
 * 1. Verifies the caller controls the address (wallet signature)
 * 2. Verifies identity is registered on-chain
 * 3. Issues identity attestation (idempotent)
 * 4. Computes trust score
 * 5. Commits score on-chain (if SCORE_WRITER_ROLE available)
 *
 * Security:
 * - Requires signed nonce (caller must control the address)
 * - Layered rate limiting (per-address, per-IP, global)
 * - Distributed lock prevents concurrent activation
 * - Idempotent: safe to call multiple times
 * - Never trusts client-supplied scores
 *
 * Response includes step-by-step status for transparency.
 */

import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { requireSignedNonce } from "../middleware/auth.js";
import { activatePassport, getActivationStatus } from "../services/activationService.js";
import { isValidAddress } from "../utils/address.js";

const router = Router();

// ── Layered Rate Limiting ──────────────────────────────────────────────────

// Layer 1: Per-address rate limit (primary — prevents abuse per wallet)
const perAddressLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 2, // 2 attempts per address per 5 minutes
  keyGenerator: (req) => {
    const address = req.params.address?.toLowerCase() || "unknown";
    return `addr:${address}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many activation attempts. Wait 5 minutes before retrying.",
    },
  },
});

// Layer 2: Per-IP rate limit (prevents abuse from a single IP across addresses)
const perIPLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 activations per IP per 5 minutes
  keyGenerator: (req) => `ip:${req.ip || req.socket.remoteAddress || "unknown"}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many activation requests from this IP. Wait before retrying.",
    },
  },
});

// Layer 3: Global rate limit (prevents system-wide overload)
const globalLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 20, // 20 activations per minute globally
  keyGenerator: () => "activate_global",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "System is busy. Try again shortly.",
    },
  },
});

// Escalating cooldown after repeated failures
const failureCooldowns = new Map<string, { count: number; lastFailure: number }>();
const FAILURE_THRESHOLD = 3;
const COOLDOWN_BASE_MS = 60_000; // 1 minute base cooldown

function checkFailureCooldown(address: string): number | null {
  const key = address.toLowerCase();
  const record = failureCooldowns.get(key);
  if (!record || record.count < FAILURE_THRESHOLD) return null;

  // Exponential backoff: base * 2^(count - threshold)
  const cooldownMs = COOLDOWN_BASE_MS * Math.pow(2, record.count - FAILURE_THRESHOLD);
  const elapsed = Date.now() - record.lastFailure;

  if (elapsed < cooldownMs) {
    return Math.ceil((cooldownMs - elapsed) / 1000); // seconds remaining
  }
  return null;
}

function recordFailure(address: string): void {
  const key = address.toLowerCase();
  const existing = failureCooldowns.get(key);
  if (existing) {
    existing.count++;
    existing.lastFailure = Date.now();
  } else {
    failureCooldowns.set(key, { count: 1, lastFailure: Date.now() });
  }
}

function clearFailures(address: string): void {
  failureCooldowns.delete(address.toLowerCase());
}

// ── GET /passport/:address/activate (status check) ─────────────────────────

router.get("/:address/activate", async (req: Request, res: Response) => {
  const address = req.params.address;
  if (!isValidAddress(address)) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_ADDRESS", message: "Invalid Ethereum address" },
    });
    return;
  }

  const status = getActivationStatus(address);
  res.json({
    success: true,
    data: {
      address: address.toLowerCase(),
      activated: status.activated,
      status: status.record?.status || "NOT_STARTED",
      identityAttestationTx: status.record?.identityAttestationTx || null,
      scoreCommitTx: status.record?.scoreCommitTx || null,
      updatedAt: status.record?.updatedAt || null,
    },
  });
});

// ── POST /passport/:address/activate ───────────────────────────────────────

router.post(
  "/:address/activate",
  globalLimiter,
  perIPLimiter,
  perAddressLimiter,
  requireSignedNonce,
  async (req: Request, res: Response) => {
    try {
      const address = req.params.address;

      // 1. Validate address format
      if (!isValidAddress(address)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ADDRESS", message: "Invalid Ethereum address" },
        });
        return;
      }

      // 2. Verify the caller controls this address (from signed nonce middleware)
      const callerAddress = req.verifiedAddress;
      if (!callerAddress) {
        res.status(401).json({
          success: false,
          error: { code: "NO_VERIFIED_ADDRESS", message: "Wallet signature required" },
        });
        return;
      }

      // 3. The URL address must match the signed address
      if (callerAddress.toLowerCase() !== address.toLowerCase()) {
        res.status(403).json({
          success: false,
          error: {
            code: "ADDRESS_MISMATCH",
            message: "You can only activate your own passport",
          },
        });
        return;
      }

      // 4. Check escalating cooldown after repeated failures
      const cooldownSeconds = checkFailureCooldown(address);
      if (cooldownSeconds !== null) {
        res.status(429).json({
          success: false,
          error: {
            code: "COOLDOWN",
            message: `Too many failed attempts. Wait ${cooldownSeconds} seconds before retrying.`,
            retryAfter: cooldownSeconds,
          },
        });
        return;
      }

      // 5. Execute the activation pipeline
      const callerIp = req.ip || req.socket.remoteAddress || undefined;
      const result = await activatePassport(address, callerAddress, callerIp);

      if (result.success) {
        clearFailures(address);
        res.json({
          success: true,
          data: result,
        });
      } else {
        recordFailure(address);

        // Map activation failure codes to HTTP status codes
        const statusMap: Record<string, number> = {
          INVALID_ADDRESS: 400,
          CALLER_MISMATCH: 403,
          NOT_REGISTERED: 400,
          ATTESTATION_EXISTS: 409,
          ATTESTATION_FAILED: 502,
          SCHEMA_NOT_FOUND: 500,
          SCORE_COMPUTATION_FAILED: 500,
          SCORE_ROLE_MISSING: 503,
          SCORE_TX_FAILED: 502,
          CONCURRENT_ACTIVATION: 409,
          INTERNAL_ERROR: 500,
        };

        const httpStatus = statusMap[result.failure || "INTERNAL_ERROR"] || 500;

        res.status(httpStatus).json({
          success: false,
          error: {
            code: result.failure || "ACTIVATION_FAILED",
            message: getErrorMessage(result.failure),
            steps: result.steps,
            auditId: result.audit.activationId,
          },
        });
      }
    } catch (err) {
      console.error("[activate] Unhandled error:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred during activation",
        },
      });
    }
  }
);

// ── Helper ─────────────────────────────────────────────────────────────────

function getErrorMessage(failure?: string): string {
  const messages: Record<string, string> = {
    INVALID_ADDRESS: "Invalid Ethereum address format",
    CALLER_MISMATCH: "You can only activate your own passport",
    NOT_REGISTERED: "Identity not registered. Complete registration first.",
    ATTESTATION_EXISTS: "Identity attestation already exists",
    ATTESTATION_FAILED: "Failed to issue identity attestation on-chain",
    SCHEMA_NOT_FOUND: "Identity schema not found. Contact support.",
    SCORE_COMPUTATION_FAILED: "Failed to compute trust score",
    SCORE_ROLE_MISSING: "Score writer role not configured. Contact support.",
    SCORE_TX_FAILED: "Failed to commit score on-chain",
    CONCURRENT_ACTIVATION: "Another activation is in progress. Try again in a moment.",
    INTERNAL_ERROR: "An unexpected error occurred",
  };
  return messages[failure || "INTERNAL_ERROR"] || "Activation failed";
}

export default router;

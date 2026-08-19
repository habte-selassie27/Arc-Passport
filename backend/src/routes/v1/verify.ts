/**
 * Developer Verification API — /v1/verify/:address
 *
 * Provides a simple, JSON-based verification endpoint for third-party apps
 * to check if a wallet address passes ArcPass's trust scoring threshold.
 *
 * GET /v1/verify/:address?policy=high-security&threshold=30
 *
 * Returns: { passed, score, threshold, attestationCount, uniqueIssuers, activeCategories }
 *
 * This is the "composable trust layer" API inspired by Human Passport's verification
 * endpoint pattern — apps can integrate ArcPass verification with a single HTTP call.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { isValidAddress } from "../../utils/address.js";
import { getPassport } from "../../services/passportService.js";
import { verifyAddress, getPolicy, type VerificationResult } from "../../services/scoringService.js";

const router = Router();

const VerifyQuerySchema = z.object({
  /** Scoring policy preset: "default" | "high-security" | "low-friction" */
  policy: z.enum(["default", "high-security", "low-friction"]).optional().default("default"),
  /** Override the pass/fail threshold (0–100). Takes precedence over policy default. */
  threshold: z.coerce.number().min(0).max(100).optional(),
  /** Include full category breakdown in response (slightly larger payload). */
  breakdown: z.coerce.boolean().optional().default(false),
});

/**
 * GET /v1/verify/:address
 *
 * Public endpoint — no auth required. This is the primary developer integration point.
 * Third-party apps call this to verify a wallet's trust score against ArcPass attestations.
 */
router.get("/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!isValidAddress(address)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ADDRESS",
          message: "Invalid Ethereum address",
          hint: "Provide a valid 0x-prefixed 40-hex-character address",
        },
      });
      return;
    }

    const queryResult = VerifyQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PARAMS",
          message: "Invalid query parameters",
          hint: queryResult.error.issues.map((i) => i.message).join("; "),
        },
      });
      return;
    }

    const { policy: policyName, threshold: thresholdOverride, breakdown } = queryResult.data;

    // Fetch the passport (includes on-chain claims, validation, and trust score)
    const passport = await getPassport(address as `0x${string}`);

    // Use the pre-computed trust score from the passport
    const policy = getPolicy(policyName);
    const result: VerificationResult = {
      passed:           passport.trustScore.passed,
      score:            passport.trustScore.score,
      threshold:        thresholdOverride ?? passport.trustScore.threshold,
      attestationCount: passport.trustScore.totalClaims,
      uniqueIssuers:    passport.trustScore.totalIssuers,
      activeCategories: passport.trustScore.activeCategories,
      verifiedAt:       Date.now(),
      breakdown:        breakdown ? passport.trustScore.categories : undefined,
    };

    // Re-check with threshold override if provided
    if (thresholdOverride !== undefined) {
      result.passed = result.score >= thresholdOverride;
      result.threshold = thresholdOverride;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: "VERIFICATION_FAILED",
        message: (err as Error).message,
        hint: "Ensure the address has an on-chain identity and the backend is connected to Arc Testnet",
      },
    });
  }
});

/**
 * POST /v1/verify/batch
 *
 * Batch verify multiple addresses in a single request.
 * Body: { addresses: string[], policy?: string, threshold?: number }
 */
router.post("/batch", async (req: Request, res: Response) => {
  try {
    const { addresses, policy: policyName, threshold: thresholdOverride } = req.body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_ADDRESSES",
          message: "Provide an array of addresses to verify",
          hint: '{ "addresses": ["0x..."], "policy": "default" }',
        },
      });
      return;
    }

    if (addresses.length > 50) {
      res.status(400).json({
        success: false,
        error: {
          code: "TOO_MANY_ADDRESSES",
          message: "Maximum 50 addresses per batch request",
          hint: "Split into multiple requests of 50 or fewer addresses",
        },
      });
      return;
    }

    const invalidAddresses = addresses.filter((a: string) => !isValidAddress(a));
    if (invalidAddresses.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ADDRESSES",
          message: `${invalidAddresses.length} invalid address(es) in request`,
          hint: `Invalid: ${invalidAddresses.slice(0, 5).join(", ")}${invalidAddresses.length > 5 ? "..." : ""}`,
        },
      });
      return;
    }

    const policy = getPolicy(policyName || "default");
    const results = await Promise.allSettled(
      addresses.map(async (addr: string) => {
        const passport = await getPassport(addr as `0x${string}`);
        const verification = verifyAddress(passport.services, policy, thresholdOverride);
        return { address: addr, ...verification };
      })
    );

    const data = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        address: addresses[i],
        passed:  false,
        score:   0,
        threshold: thresholdOverride ?? policy.passThreshold,
        attestationCount: 0,
        uniqueIssuers: 0,
        activeCategories: [],
        verifiedAt: Date.now(),
        error:   (r.reason as Error).message,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: "BATCH_VERIFICATION_FAILED",
        message: (err as Error).message,
      },
    });
  }
});

export default router;

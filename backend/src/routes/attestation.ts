import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { requireSignedNonce } from "../middleware/auth.js";
import { issuerGuard } from "../middleware/issuerGuard.js";
import {
  issueAttestation,
  revokeClaim,
  getClaim,
  isValidClaim,
  recordAttestationMemo,
} from "../services/attestationService.js";

const router = Router();

// Strict rate limit on attestation write endpoints: max 5 per address per minute.
// Per AGENTS.md §15.5.3, write endpoints need a tighter limit than the global 100/min
// to prevent an attacker from exhausting the issuer wallet's gas balance via flood.
const attestWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => (req.headers["x-wallet-address"] as string) || req.ip,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many write requests (max 5/min)" } },
});

router.post("/attest", requireSignedNonce, issuerGuard, async (req: Request, res: Response) => {
  try {
    const { subject, schemaId, dataCommitment, expiresAt, complianceRef } = req.body;
    if (!subject || !schemaId || dataCommitment === undefined) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "subject, schemaId, dataCommitment required" },
      });
      return;
    }

    const txHash = await issueAttestation(
      subject,
      schemaId,
      dataCommitment,
      expiresAt ?? 0
    );

    let memoHash: string | undefined;
    if (complianceRef) {
      memoHash = await recordAttestationMemo(subject, complianceRef);
    }

    res.json({ success: true, data: { txHash, memoHash } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "ATTEST_FAILED", message: (err as Error).message },
    });
  }
});

router.post("/revoke", requireSignedNonce, issuerGuard, async (req: Request, res: Response) => {
  try {
    const { claimId } = req.body;
    if (!claimId) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "claimId required" },
      });
      return;
    }

    const txHash = await revokeClaim(claimId);
    res.json({ success: true, data: { txHash } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "REVOKE_FAILED", message: (err as Error).message },
    });
  }
});

router.get("/claim/:claimId", async (req: Request, res: Response) => {
  try {
    const claim = await getClaim(req.params.claimId as `0x${string}`);
    const valid = await isValidClaim(req.params.claimId as `0x${string}`);
    res.json({ success: true, data: { ...claim, valid } });
  } catch (err) {
    res.status(404).json({
      success: false,
      error: { code: "CLAIM_NOT_FOUND", message: (err as Error).message },
    });
  }
});

router.get("/:address", async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: { address: req.params.address, message: "Query specific schema via /passport/:address" },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "FETCH_ERROR", message: (err as Error).message },
    });
  }
});

export default router;

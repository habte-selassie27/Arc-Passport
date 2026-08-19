/**
 * routes/zk.ts — ZK proof verification and attestation issuance.
 *
 * Endpoints:
 *   GET  /zk/verifiers               — list registered ZK verifier backends
 *   GET  /zk/stats                    — total proofs verified, proof count
 *   POST /zk/verify                   — verify a ZK proof (dry-run, no attestation)
 *   POST /zk/submit                   — submit a proof + issue attestation (authenticated)
 *   POST /zk/submit/attribute         — submit an attribute proof (authenticated)
 *   GET  /zk/document-types           — list trusted document types
 *   GET  /zk/proof/:proofHash         — check if a proof hash has been used
 */

import { Router, Request, Response } from "express";
import { zkProofService } from "../services/zkProofService.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import { requireSignedNonce } from "../middleware/auth.js";

const router = Router();

function handleError(res: Response, err: unknown) {
  if (err instanceof ArcPassError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  } else {
    const e = err as Error;
    res.status(500).json({ success: false, error: { code: "ZK_ERROR", message: e.message } });
  }
}

function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isValidBytes32(id: string): id is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(id);
}

// ── GET /zk/verifiers — list registered ZK verifiers ──

router.get("/verifiers", async (_req: Request, res: Response) => {
  try {
    const verifiers = await zkProofService.getVerifiers();
    res.json({ success: true, data: { count: verifiers.length, verifiers } });
  } catch (err) {
    handleError(res, err);
  }
});

// ── GET /zk/stats — aggregate ZK stats ──

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const totalProofsVerified = await zkProofService.getTotalProofsVerified();
    const verifiers = await zkProofService.getVerifiers();
    res.json({
      success: true,
      data: {
        totalProofsVerified,
        activeVerifiers: verifiers.filter((v) => v.active).length,
        totalVerifiers: verifiers.length,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ── POST /zk/verify — dry-run proof verification (no attestation issued) ──

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { verifierId, proof, publicInputs, subject, proofHash } = req.body;

    if (verifierId === undefined) {
      throw new ArcPassError("MISSING_PARAMS", "verifierId is required", 400);
    }
    if (!proof) {
      throw new ArcPassError("MISSING_PARAMS", "proof is required", 400);
    }
    if (!isValidAddress(subject)) {
      throw Errors.InvalidSubject(subject ?? "");
    }
    if (!isValidBytes32(proofHash)) {
      throw new ArcPassError("INVALID_PROOF_HASH", "proofHash must be bytes32", 400);
    }

    // Check if proof was already used
    const alreadyUsed = await zkProofService.isProofUsed(proofHash);

    res.json({
      success: true,
      data: {
        verifierId,
        subject,
        proofHash,
        alreadyUsed,
        message: alreadyUsed
          ? "Proof has already been used (replay detected)"
          : "Proof not yet submitted — ready for submission",
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ── POST /zk/submit — submit a passport authenticity proof (authenticated) ──

router.post("/submit", requireSignedNonce, async (req: Request, res: Response) => {
  try {
    const { verifierId, proof, publicInputs, proofHash, documentType, issuedAt, expiresAt } =
      req.body;
    const subject = req.verifiedAddress as `0x${string}`;

    if (!verifierId && verifierId !== 0) {
      throw new ArcPassError("MISSING_PARAMS", "verifierId is required", 400);
    }
    if (!proof) {
      throw new ArcPassError("MISSING_PARAMS", "proof is required", 400);
    }
    if (!documentType) {
      throw new ArcPassError("MISSING_PARAMS", "documentType is required", 400);
    }
    if (!isValidBytes32(proofHash)) {
      throw new ArcPassError("INVALID_PROOF_HASH", "proofHash must be bytes32", 400);
    }

    // Check replay
    const alreadyUsed = await zkProofService.isProofUsed(proofHash);
    if (alreadyUsed) {
      throw new ArcPassError("PROOF_REPLAYED", "This proof has already been used", 409);
    }

    // Check document type
    const trusted = await zkProofService.isDocumentTypeTrusted(documentType);
    if (!trusted) {
      throw new ArcPassError("UNTRUSTED_DOCUMENT", `Document type '${documentType}' is not trusted`, 400);
    }

    // Get wallet ID from env (per-service issuer wallet)
    const walletId = process.env.CIRCLE_ZK_ISSUER_WALLET_ID || process.env.CIRCLE_ISSUER_WALLET_ID;
    if (!walletId) {
      throw Errors.IssuerNotConfigured("zk", "CIRCLE_ZK_ISSUER_WALLET_ID");
    }

    const result = await zkProofService.submitPassportProof(
      {
        verifierId,
        proof,
        publicInputs: (publicInputs || []).map(BigInt),
        proofHash,
        documentType,
        issuedAt: issuedAt || Math.floor(Date.now() / 1000),
        expiresAt: expiresAt || 0,
      },
      walletId
    );

    res.json({
      success: true,
      data: {
        message: "ZK passport proof submitted and attestation issued",
        txHash: result.txHash,
        claimId: result.claimId,
        subject,
        documentType,
        proofHash,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ── POST /zk/submit/attribute — submit a ZK attribute proof (authenticated) ──

router.post("/submit/attribute", requireSignedNonce, async (req: Request, res: Response) => {
  try {
    const { verifierId, proof, publicInputs, proofHash, attributeHash, expiresAt } = req.body;
    const subject = req.verifiedAddress as `0x${string}`;

    if (!verifierId && verifierId !== 0) {
      throw new ArcPassError("MISSING_PARAMS", "verifierId is required", 400);
    }
    if (!proof) {
      throw new ArcPassError("MISSING_PARAMS", "proof is required", 400);
    }
    if (!isValidBytes32(proofHash)) {
      throw new ArcPassError("INVALID_PROOF_HASH", "proofHash must be bytes32", 400);
    }
    if (!isValidBytes32(attributeHash)) {
      throw new ArcPassError("INVALID_ATTRIBUTE_HASH", "attributeHash must be bytes32", 400);
    }

    // Check replay
    const alreadyUsed = await zkProofService.isProofUsed(proofHash);
    if (alreadyUsed) {
      throw new ArcPassError("PROOF_REPLAYED", "This proof has already been used", 409);
    }

    const walletId = process.env.CIRCLE_ZK_ISSUER_WALLET_ID || process.env.CIRCLE_ISSUER_WALLET_ID;
    if (!walletId) {
      throw Errors.IssuerNotConfigured("zk", "CIRCLE_ZK_ISSUER_WALLET_ID");
    }

    const result = await zkProofService.submitAttributeProof(
      {
        verifierId,
        proof,
        publicInputs: (publicInputs || []).map(BigInt),
        proofHash,
        attributeHash,
        expiresAt: expiresAt || 0,
      },
      walletId
    );

    res.json({
      success: true,
      data: {
        message: "ZK attribute proof submitted and attestation issued",
        txHash: result.txHash,
        claimId: result.claimId,
        subject,
        attributeHash,
        proofHash,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ── GET /zk/document-types — list trusted document types ──

router.get("/document-types", async (_req: Request, res: Response) => {
  try {
    const docTypes = ["passport", "national_id", "drivers_license", "residence_permit"];
    const results: Record<string, boolean> = {};
    for (const dt of docTypes) {
      try {
        results[dt] = await zkProofService.isDocumentTypeTrusted(dt);
      } catch {
        results[dt] = false;
      }
    }
    res.json({ success: true, data: results });
  } catch (err) {
    handleError(res, err);
  }
});

// ── GET /zk/proof/:proofHash — check if a proof hash has been used ──

router.get("/proof/:proofHash", async (req: Request, res: Response) => {
  try {
    const { proofHash } = req.params;
    if (!isValidBytes32(proofHash)) {
      throw new ArcPassError("INVALID_PROOF_HASH", "proofHash must be bytes32", 400);
    }

    const used = await zkProofService.isProofUsed(proofHash);
    res.json({
      success: true,
      data: { proofHash, used, message: used ? "Proof already used" : "Proof available" },
    });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;

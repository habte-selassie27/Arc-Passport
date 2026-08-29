import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { publicClient } from "../services/arcService.js";
import { requireSignedNonce } from "../middleware/auth.js";
import { issuerGuard } from "../middleware/issuerGuard.js";
import { revokerGuard } from "../middleware/revokerGuard.js";
import {
  issueAttestation,
  revokeClaim,
  adminRevokeClaim,
  getClaim,
  isValidClaim,
  recordAttestationMemo,
} from "../services/attestationService.js";
import { getClaimPayload } from "../services/claimPayloadStore.js";
import { getFieldProof } from "../utils/merkleClaimBuilder.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { PASSPORT_VERIFIER_ABI } from "../abis/PassportVerifier.js";

const router = Router();

// Strict rate limit on attestation write endpoints: max 5 per address per minute.
// Per AGENTS.md §15.5.3, write endpoints need a tighter limit than the global 100/min
// to prevent an attacker from exhausting the issuer wallet's gas balance via flood.
const attestWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => (req.headers["x-wallet-address"] as string) || req.ip || "unknown",
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many write requests (max 5/min)" } },
});

router.post("/attest", requireSignedNonce, issuerGuard, attestWriteLimiter, async (req: Request, res: Response) => {
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

router.post("/revoke", requireSignedNonce, issuerGuard, attestWriteLimiter, async (req: Request, res: Response) => {
  try {
    const { claimId } = req.body;
    if (!claimId) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "claimId required" },
      });
      return;
    }

    // On-chain revoke() now enforces c.issuer == msg.sender (Circle wallet).
    // issuerGuard ensures human caller holds ISSUER_ROLE. The Circle wallet that
    // will sign must be the original issuer — enforced on-chain. With per-service
    // wallets this gives issuer isolation; with a single wallet all claims share
    // the same issuer wallet.
    const txHash = await revokeClaim(claimId);
    res.json({ success: true, data: { txHash } });
  } catch (err) {
    const msg = (err as Error).message;
    const isNotIssuer = msg.includes("NotIssuer") || msg.includes("ArcPass__NotIssuer");
    res.status(isNotIssuer ? 403 : 500).json({
      success: false,
      error: { code: isNotIssuer ? "NOT_CLAIM_ISSUER" : "REVOKE_FAILED", message: msg },
    });
  }
});

router.post("/admin-revoke", requireSignedNonce, revokerGuard, attestWriteLimiter, async (req: Request, res: Response) => {
  try {
    const { claimId } = req.body;
    if (!claimId) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "claimId required" },
      });
      return;
    }

    const txHash = await adminRevokeClaim(claimId);
    res.json({ success: true, data: { txHash } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "ADMIN_REVOKE_FAILED", message: (err as Error).message },
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

// ─── SELECTIVE DISCLOSURE: field classification + Merkle proofs ────────

/**
 * GET /attestation/issuers
 * Returns all on-chain issuers with the credential types they support,
 * derived from indexed ClaimIssued events. Public endpoint — no auth.
 */
router.get("/issuers", async (_req: Request, res: Response) => {
  try {
    const issuerAddresses = (await publicClient.readContract({
      address: ADDRESSES.attestationRegistry!,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "getIssuers",
    })) as `0x${string}`[];

    const { getAllIndexedClaims } = await import("../indexer/claimIndexer.js");
    const allClaims = getAllIndexedClaims();

    const { SCHEMA_ID_TO_SERVICE } = await import("../constants/schemas.js");

    const issuerMap = new Map<string, Set<string>>();
    for (const addr of issuerAddresses) {
      issuerMap.set(addr.toLowerCase(), new Set());
    }

    for (const claim of allClaims) {
      const key = claim.issuer.toLowerCase();
      const existing = issuerMap.get(key);
      if (existing) {
        const service = SCHEMA_ID_TO_SERVICE[claim.schemaId];
        if (service) existing.add(service);
      }
    }

    const issuers = issuerAddresses.map((addr) => ({
      address: addr,
      credentialTypes: Array.from(issuerMap.get(addr.toLowerCase()) ?? []),
    }));

    res.json({ success: true, data: { issuers } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "ISSUERS_FETCH_FAILED", message: (err as Error).message },
    });
  }
});

// ─── SELECTIVE DISCLOSURE: field classification + Merkle proofs ────────

/**
 * GET /attestation/:claimId/fields
 * Returns the claim's field list with classifications. Requires the caller
 * to be the claim subject (signed nonce).
 */
router.get("/claim/:claimId/fields", requireSignedNonce, async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    const caller = (req.headers["x-wallet-address"] as string)?.toLowerCase();

    // Fetch the claim on-chain to get the subject
    const claim = await publicClient.readContract({
      address: ADDRESSES.attestationRegistry!,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "getClaim",
      args: [claimId as `0x${string}`],
    }) as unknown as { subject: string; revoked: boolean; expiresAt: bigint };

    if (!claim || !claim.subject || claim.subject === "0x0000000000000000000000000000000000000000") {
      res.status(404).json({ success: false, error: { code: "CLAIM_NOT_FOUND", message: "Claim not found" } });
      return;
    }

    if (caller !== claim.subject.toLowerCase()) {
      res.status(403).json({ success: false, error: { code: "NOT_SUBJECT", message: "Only the claim subject can view field classifications" } });
      return;
    }

    if (claim.revoked) {
      res.status(410).json({ success: false, error: { code: "CLAIM_REVOKED", message: "Claim has been revoked" } });
      return;
    }

    if (claim.expiresAt > 0n && BigInt(Math.floor(Date.now() / 1000)) >= claim.expiresAt) {
      res.status(410).json({ success: false, error: { code: "CLAIM_EXPIRED", message: "Claim has expired" } });
      return;
    }

    const payload = getClaimPayload(claimId);
    if (!payload) {
      // Legacy claim — no Merkle payload stored
      res.status(200).json({
        success: true,
        data: {
          claimId,
          fields: [],
          legacy: true,
          message: "Selective disclosure not available for legacy claims",
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        claimId,
        fields: payload.fields.map((f) => ({
          name: f.name,
          type: f.type,
          classification: f.classification,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

/**
 * GET /attestation/:claimId/field/:fieldName/proof
 * Returns the Merkle proof for a specific field. Requires the caller
 * to be the claim subject (signed nonce).
 */
router.get("/claim/:claimId/field/:fieldName/proof", requireSignedNonce, async (req: Request, res: Response) => {
  try {
    const { claimId, fieldName } = req.params;
    const caller = (req.headers["x-wallet-address"] as string)?.toLowerCase();

    const claim = await publicClient.readContract({
      address: ADDRESSES.attestationRegistry!,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "getClaim",
      args: [claimId as `0x${string}`],
    }) as unknown as { subject: string; revoked: boolean; expiresAt: bigint };

    if (!claim || !claim.subject || claim.subject === "0x0000000000000000000000000000000000000000") {
      res.status(404).json({ success: false, error: { code: "CLAIM_NOT_FOUND", message: "Claim not found" } });
      return;
    }

    if (caller !== claim.subject.toLowerCase()) {
      res.status(403).json({ success: false, error: { code: "NOT_SUBJECT", message: "Only the claim subject can request field proofs" } });
      return;
    }

    const payload = getClaimPayload(claimId);
    if (!payload) {
      res.status(404).json({ success: false, error: { code: "NO_PROOF_AVAILABLE", message: "No Merkle payload available (legacy claim)" } });
      return;
    }

    const fieldIndex = payload.fields.findIndex((f) => f.name === fieldName);
    if (fieldIndex === -1) {
      res.status(404).json({ success: false, error: { code: "FIELD_NOT_FOUND", message: `Field "${fieldName}" not found in claim` } });
      return;
    }

    // Reconstruct the Merkle tree from stored leaves to generate the proof
    const { MerkleTree } = await import("merkletreejs");
    const { keccak256 } = await import("viem");
    const tree = new MerkleTree(
      payload.leaves.map((l) => Buffer.from(l.slice(2), "hex")),
      (data: Buffer) => Buffer.from(keccak256(`0x${data.toString("hex")}`).slice(2), "hex"),
      { sortPairs: true }
    );
    const proof = getFieldProof(tree, fieldIndex);
    const leaf = payload.leaves[fieldIndex];

    res.json({
      success: true,
      data: {
        claimId,
        leaf,
        proof,
        leafIndex: fieldIndex,
        field: payload.fields[fieldIndex],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "PROOF_GENERATION_FAILED", message: (err as Error).message } });
  }
});

/**
 * GET /attestation/:claimId/field/:fieldName/verify
 * Verifies a field proof on-chain. Public endpoint — no auth required.
 * The verifier (anyone) can check that a specific field is committed to
 * by the on-chain claim without learning the value (unless also shared).
 */
router.get("/claim/:claimId/field/:fieldName/verify", async (req: Request, res: Response) => {
  try {
    const { claimId, fieldName } = req.params;
    const { leaf, leafIndex, proof } = req.query as {
      leaf?: string;
      leafIndex?: string;
      proof?: string;
    };

    if (!leaf || !leafIndex || !proof) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_PARAMS", message: "Required query params: leaf, leafIndex, proof" },
      });
      return;
    }

    const proofArray = JSON.parse(proof) as `0x${string}`[];
    const leafIndexNum = parseInt(leafIndex, 10);

    const valid = await publicClient.readContract({
      address: ADDRESSES.passportVerifier!,
      abi: PASSPORT_VERIFIER_ABI,
      functionName: "verifyField",
      args: [
        claimId as `0x${string}`,
        leaf as `0x${string}`,
        proofArray,
        BigInt(leafIndexNum),
      ],
    }) as boolean;

    res.json({ success: true, data: { valid, claimId, fieldName, leafIndex: leafIndexNum } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "VERIFY_FAILED", message: (err as Error).message } });
  }
});

export default router;

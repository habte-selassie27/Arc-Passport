import { Router } from "express";
import { publicClient } from "../services/arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import {
  getEASClaims,
  getEASClaim,
  getClaimsBySubject,
  getClaimsByIssuer,
  getClaimsBySchema,
  getReferencedClaims,
  getEASStats,
} from "../indexer/easIndexer.js";
import { ALL_SCHEMAS } from "../constants/schemas.js";
import { ArcPassError, Errors } from "../utils/errors.js";

const router = Router();

function handleError(res: any, err: unknown) {
  if (err instanceof ArcPassError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  } else {
    const e = err as Error;
    res.status(500).json({ success: false, error: { code: "EAS_ERROR", message: e.message } });
  }
}

function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isValidBytes32(id: string): id is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(id);
}

// ── Stats ──

router.get("/stats", (_req, res) => {
  try {
    const stats = getEASStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Schema endpoints ──

router.get("/schemas", (_req, res) => {
  try {
    // Combine on-chain schemas with canonical off-chain definitions
    const schemas: Array<{
      uid: string;
      name: string;
      description: string;
      fields: string;
      registry: string;
    }> = [];

    // Add canonical schemas from constants
    for (const [serviceKey, schemasMap] of Object.entries(ALL_SCHEMAS)) {
      for (const [key, def] of Object.entries(schemasMap as Record<string, any>)) {
        const fieldsArray = Array.isArray(def.fields) ? def.fields : [];
        schemas.push({
          uid: def.id ?? `0x${"0".repeat(64)}`,
          name: def.name ?? key,
          description: def.description ?? `${serviceKey} attestation schema`,
          fields: fieldsArray.map((f: { name: string; type: string }) => `${f.name}:${f.type}`).join(", "),
          registry: "canonical",
        });
      }
    }

    res.json({ success: true, data: { count: schemas.length, schemas } });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/schemas/:uid", async (req, res) => {
  try {
    const uid = req.params.uid as `0x${string}`;
    if (!isValidBytes32(uid)) {
      throw new ArcPassError("INVALID_SCHEMA_UID", `Invalid schema UID: ${uid}`, 400);
    }

    // Find in canonical schemas
    let found: any = null;
    for (const schemasMap of Object.values(ALL_SCHEMAS)) {
      for (const def of Object.values(schemasMap as Record<string, any>)) {
        if (def.id?.toLowerCase() === uid.toLowerCase()) {
          found = def;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      // Try on-chain lookup
      if (ADDRESSES.schemaRegistry) {
        try {
          const schema = await publicClient.readContract({
            address: ADDRESSES.schemaRegistry,
            abi: [{
              type: "function",
              name: "getSchema",
              inputs: [{ name: "schemaId", type: "bytes32" }],
              outputs: [
                { name: "schemaId", type: "bytes32" },
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "fieldsJson", type: "string" },
                { name: "registrant", type: "address" },
                { name: "registeredAt", type: "uint256" },
              ],
              stateMutability: "view",
            }] as const,
            functionName: "getSchema",
            args: [uid],
          });

          const claims = getClaimsBySchema(uid);
          res.json({
            success: true,
            data: {
              uid,
              name: schema[1],
              version: schema[2],
              fields: schema[3],
              registrant: schema[4],
              registeredAt: Number(schema[5]),
              registry: "on-chain",
              attestationCount: claims.length,
            },
          });
          return;
        } catch {
          // Schema not found on-chain
        }
      }

      throw new ArcPassError("SCHEMA_NOT_FOUND", `Schema ${uid} not found`, 404);
    }

    const claims = getClaimsBySchema(uid);
    const fieldsArray = Array.isArray(found.fields) ? found.fields : [];
    res.json({
      success: true,
      data: {
        uid,
        name: found.name,
        description: found.description,
        fields: fieldsArray.map((f: { name: string; type: string }) => `${f.name}:${f.type}`).join(", "),
        registry: "canonical",
        attestationCount: claims.length,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Attestation endpoints ──

router.get("/attestations", (req, res) => {
  try {
    const { subject, issuer, schemaId, refUID, valid } = req.query;

    let claims = getEASClaims();

    if (typeof subject === "string" && isValidAddress(subject)) {
      claims = claims.filter((c) => c.subject.toLowerCase() === subject.toLowerCase());
    }
    if (typeof issuer === "string" && isValidAddress(issuer)) {
      claims = claims.filter((c) => c.issuer.toLowerCase() === issuer.toLowerCase());
    }
    if (typeof schemaId === "string" && isValidBytes32(schemaId)) {
      claims = claims.filter((c) => c.schemaId.toLowerCase() === schemaId.toLowerCase());
    }
    if (typeof refUID === "string" && isValidBytes32(refUID)) {
      claims = claims.filter((c) => c.refUID.toLowerCase() === refUID.toLowerCase());
    }
    if (valid === "true") {
      const now = Math.floor(Date.now() / 1000);
      claims = claims.filter((c) => !c.revoked && (c.expiresAt === 0 || c.expiresAt > now));
    }
    if (valid === "false") {
      const now = Math.floor(Date.now() / 1000);
      claims = claims.filter((c) => c.revoked || (c.expiresAt > 0 && c.expiresAt <= now));
    }

    // Sort by issuedAt descending
    claims.sort((a, b) => b.issuedAt - a.issuedAt);

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || "20", 10)));
    const start = (page - 1) * limit;
    const paged = claims.slice(start, start + limit);

    res.json({
      success: true,
      data: {
        total: claims.length,
        page,
        limit,
        pages: Math.ceil(claims.length / limit),
        attestations: paged,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/attestations/:uid", async (req, res) => {
  try {
    const uid = req.params.uid as `0x${string}`;
    if (!isValidBytes32(uid)) {
      throw new ArcPassError("INVALID_ATTESTATION_UID", `Invalid attestation UID: ${uid}`, 400);
    }

    // Try local index first
    let claim = getEASClaim(uid);

    // Fallback to on-chain read
    if (!claim && ADDRESSES.attestationRegistry) {
      try {
        const raw = await publicClient.readContract({
          address: ADDRESSES.attestationRegistry,
          abi: ATTESTATION_REGISTRY_ABI,
          functionName: "getClaim",
          args: [uid],
        });

        claim = {
          claimId:        raw[0],
          subject:        raw[1],
          schemaId:       raw[2],
          issuer:         raw[3],
          dataCommitment: raw[4],
          issuedAt:       Number(raw[5]),
          expiresAt:      Number(raw[6]),
          revoked:        raw[7],
          refUID:         raw[8] || "0x0000000000000000000000000000000000000000000000000000000000000000",
          revokedAt:      Number(raw[9] || 0),
          blockNum:       0,
        };
      } catch {
        // Claim not found on-chain
      }
    }

    if (!claim) {
      throw new ArcPassError("ATTESTATION_NOT_FOUND", `Attestation ${uid} not found`, 404);
    }

    // Get referenced attestation (if any)
    let referencedClaim: any = null;
    if (claim.refUID !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      referencedClaim = getEASClaim(claim.refUID);
    }

    // Get referencing attestations (claims that reference this one)
    const references = getReferencedClaims(uid);

    // Determine validity
    const now = Math.floor(Date.now() / 1000);
    let status: string;
    if (claim.revoked) {
      status = "REVOKED";
    } else if (claim.expiresAt > 0 && claim.expiresAt <= now) {
      status = "EXPIRED";
    } else {
      status = "VALID";
    }

    res.json({
      success: true,
      data: {
        ...claim,
        status,
        referencedClaim,
        references: references.map((r) => ({
          claimId: r.claimId,
          subject: r.subject,
          issuer: r.issuer,
          schemaId: r.schemaId,
          issuedAt: r.issuedAt,
        })),
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Verification endpoint ──

router.get("/verify/:address", async (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    if (!isValidAddress(address)) {
      throw Errors.InvalidSubject(address);
    }

    const claims = getClaimsBySubject(address);
    const now = Math.floor(Date.now() / 1000);

    const valid = claims.filter((c) => !c.revoked && (c.expiresAt === 0 || c.expiresAt > now));
    const revoked = claims.filter((c) => c.revoked);
    const expired = claims.filter((c) => !c.revoked && c.expiresAt > 0 && c.expiresAt <= now);

    const uniqueIssuers = new Set(valid.map((c) => c.issuer.toLowerCase())).size;
    const uniqueSchemas = new Set(valid.map((c) => c.schemaId.toLowerCase())).size;

    // Try on-chain verification if PassportVerifier is available
    let onChainVerification: any = null;
    if (ADDRESSES.passportVerifier && ADDRESSES.scoreRegistry) {
      try {
        const [score, isValid, isHuman] = await publicClient.readContract({
          address: ADDRESSES.passportVerifier,
          abi: [{
            type: "function",
            name: "getScore",
            inputs: [
              { name: "subject", type: "address" },
              { name: "scorerId", type: "uint16" },
            ],
            outputs: [
              { name: "score", type: "uint16" },
              { name: "isValid", type: "bool" },
              { name: "isHuman", type: "bool" },
            ],
            stateMutability: "view",
          }] as const,
          functionName: "getScore",
          args: [address, 0],
        });

        onChainVerification = {
          score: Number(score),
          isValid,
          isHuman,
        };
      } catch {
        // Score not available
      }
    }

    res.json({
      success: true,
      data: {
        address,
        attestationCount: claims.length,
        validCount: valid.length,
        revokedCount: revoked.length,
        expiredCount: expired.length,
        uniqueIssuers,
        uniqueSchemas,
        onChainVerification,
        verifiedAt: Date.now(),
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Subject/Issuer lookup ──

router.get("/subject/:address", (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    if (!isValidAddress(address)) {
      throw Errors.InvalidSubject(address);
    }
    const claims = getClaimsBySubject(address);
    res.json({ success: true, data: { address, count: claims.length, attestations: claims } });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/attester/:address", (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    if (!isValidAddress(address)) {
      throw Errors.InvalidSubject(address);
    }
    const claims = getClaimsByIssuer(address);
    res.json({ success: true, data: { address, count: claims.length, attestations: claims } });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;

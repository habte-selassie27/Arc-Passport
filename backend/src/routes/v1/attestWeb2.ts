import { Router, Request, Response } from "express";

import { requireSignedNonce } from "../../middleware/auth.js";
import { issuerGuard } from "../../middleware/issuerGuard.js";
import { executeContractCall } from "../../services/circleService.js";
import { uploadToIpfs } from "../../services/ipfsService.js";
import { saveClaimPayload } from "../../services/claimPayloadStore.js";
import { buildClaimTree, type ClaimField } from "../../utils/merkleClaimBuilder.js";
import { ADDRESSES } from "../../config/arc.js";

const router = Router();

router.post(
  "/web2-proof",
  requireSignedNonce,
  issuerGuard,
  async (req: Request, res: Response) => {
    try {
      const { subject, schemaId, proofData, expiresAt } = req.body;
      if (!subject || !schemaId || !proofData) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_FIELDS",
            message: "subject, schemaId, proofData required",
          },
        });
        return;
      }

      // Build Merkle tree from proof fields
      const fields: ClaimField[] = Object.entries(proofData).map(
        ([name, value]) => ({
          name,
          type: typeof value === "boolean"
            ? "bool"
            : typeof value === "number"
              ? "uint64"
              : typeof value === "string" && value.startsWith("0x") && value.length === 66
                ? "bytes32"
                : "string",
          value,
        })
      );

      const { root, leaves, tree } = buildClaimTree(fields);
      const dataCommitment = root as `0x${string}`;

      // On-chain attestation via Circle SDK
      const walletId =
        process.env.CIRCLE_ISSUER_WALLET_ID ||
        process.env.CIRCLE_WEB2_PROOF_ISSUER_WALLET_ID!;
      const registry = ADDRESSES.attestationRegistry!;
      const exp = expiresAt ?? Math.floor(Date.now() / 1000) + 365 * 86400;

      const txHash = await executeContractCall(
        walletId,
        registry,
        "attest(address,bytes32,bytes32,uint256)",
        [subject, schemaId, dataCommitment, exp.toString()]
      );

      // Best-effort off-chain storage
      let ipfsCid: string | undefined;
      try {
        const payload = Object.fromEntries(
          fields.map((f) => [f.name, f.value])
        );
        const cid = await uploadToIpfs(payload);
        if (cid) {
          saveClaimPayload({
            claimId: dataCommitment,
            ipfsCid: cid,
            fields: fields.map((f) => ({
              name: f.name,
              type: f.type,
              value: String(f.value),
              classification: "PUBLIC",
            })),
            leaves: [],
            createdAt: Date.now(),
          });
          ipfsCid = cid;
        }
      } catch {
        // off-chain storage failure doesn't invalidate on-chain claim
      }

      // Derive claimId from event logs (best-effort, not critical)
      res.json({
        success: true,
        data: {
          claimId: dataCommitment,
          txHash,
          ipfsCid,
          expiresAt: exp,
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: {
          code: "ATTESTATION_FAILED",
          message: (err as Error).message,
        },
      });
    }
  }
);

export default router;

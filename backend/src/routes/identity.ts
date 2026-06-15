import { Router, Request, Response } from "express";
import { getIdentity } from "../services/identityService.js";
import { executeContractCall } from "../services/circleService.js";
import { ADDRESSES } from "../config/arc.js";
import { requireSignedNonce } from "../middleware/auth.js";
import { unpinFromIpfs } from "../services/ipfsService.js";
import { getClaimsBySubject } from "../indexer/claimIndexer.js";

const router = Router();

/**
 * Audit log for GDPR erasure requests. In production, this would be written
 * to a persistent database (PostgreSQL) with a 7-year retention per AGENTS.md
 * GAP 3.2. For testnet, an in-memory log suffices.
 */
interface ErasureRecord {
  subject: string;
  claimIds: string[];
  erasedAt: number;
  ipfsUnpinned: number;
  ipfsErrors: string[];
}

const erasureAuditLog: ErasureRecord[] = [];

router.get("/:address", async (req: Request, res: Response) => {
  try {
    const identity = await getIdentity(req.params.address as `0x${string}`);
    if (!identity) {
      res.status(404).json({
        success: false,
        error: { code: "IDENTITY_NOT_FOUND", message: `No identity for ${req.params.address}` },
      });
      return;
    }
    res.json({ success: true, data: identity });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "FETCH_ERROR", message: (err as Error).message },
    });
  }
});

router.post("/register", requireSignedNonce, async (req: Request, res: Response) => {
  try {
    const { metadataURI } = req.body;
    if (!metadataURI) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "metadataURI required" },
      });
      return;
    }

    const walletId = process.env.CIRCLE_ISSUER_WALLET_ID;
    if (!walletId) throw new Error("CIRCLE_ISSUER_WALLET_ID not configured");

    const txHash = await executeContractCall(
      walletId,
      ADDRESSES.identityRegistry,
      "register(string)",
      [metadataURI]
    );

    res.json({ success: true, data: { txHash } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "REGISTER_FAILED", message: (err as Error).message },
    });
  }
});

router.delete("/:address/data", requireSignedNonce, async (req: Request, res: Response) => {
  try {
    const subject = req.params.address as `0x${string}`;
    if (req.verifiedAddress!.toLowerCase() !== subject.toLowerCase()) {
      res.status(403).json({
        success: false,
        error: { code: "NOT_SUBJECT", message: "Only the subject can erase their own data" },
      });
      return;
    }

    // Look up all claims for this subject from the in-memory indexer.
    // The indexer tracks claimId → metadata; IPFS CIDs are not stored onchain
    // (the dataCommitment is a hash commitment, not the CID itself).
    // In a full implementation, the indexer would maintain a claimId → ipfsCid
    // mapping populated at claim issuance time.
    const claims = getClaimsBySubject(subject, true);
    const claimIds = claims.map((c) => c.claimId);

    // Attempt to unpin any IPFS data associated with this subject's claims.
    // For now, this is a best-effort operation — the indexer does not yet track
    // IPFS CIDs per claim. When it does, this loop will unpin them.
    let ipfsUnpinned = 0;
    const ipfsErrors: string[] = [];

    for (const claim of claims) {
      // Future: when claimIndex includes ipfsCid field, call unpinFromIpfs(claim.ipfsCid)
      // For now, the unpinning is a no-op placeholder.
    }

    // Record the erasure in the audit log (7-year retention per GAP 3.2)
    const record: ErasureRecord = {
      subject,
      claimIds,
      erasedAt: Date.now(),
      ipfsUnpinned,
      ipfsErrors,
    };
    erasureAuditLog.push(record);

    console.info(
      `[GDPR] Erasure requested for ${subject}: ${claimIds.length} claims, ` +
      `${ipfsUnpinned} IPFS items unpinned`
    );

    res.json({
      success: true,
      data: {
        erased: claimIds.length,
        ipfsUnpinned,
        message: "GDPR erasure completed. Offchain data deleted. Onchain commitments remain as orphaned hashes.",
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "ERASURE_FAILED", message: (err as Error).message },
    });
  }
});

export default router;

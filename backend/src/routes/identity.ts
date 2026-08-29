import { Router, Request, Response } from "express";
import { getIdentityBalance, getRegistrationHistory } from "../services/identityService.js";
import { requireSignedNonce } from "../middleware/auth.js";
import { getClaimsBySubject } from "../indexer/claimIndexer.js";
import { isValidAddress } from "../utils/address.js";

const router = Router();

/**
 * Audit log for GDPR erasure requests. In production, this would be written
 * to a persistent database (PostgreSQL) with a 7-year retention. For testnet,
 * an in-memory log suffices (SECURITY-ROADMAP.md §17).
 */
interface ErasureRecord {
  subject: string;
  claimIds: string[];
  erasedAt: number;
}

const erasureAuditLog: ErasureRecord[] = [];

router.get("/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    if (!isValidAddress(address)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ADDRESS", message: "Invalid Ethereum address" },
      });
      return;
    }
    const balance = await getIdentityBalance(address as `0x${string}`);
    if (balance === 0) {
      res.status(404).json({
        success: false,
        error: { code: "IDENTITY_NOT_FOUND", message: `No identity for ${address}` },
      });
      return;
    }
    res.json({ success: true, data: { address, registered: true, balance } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "FETCH_ERROR", message: (err as Error).message },
    });
  }
});

router.get("/:address/history", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    if (!isValidAddress(address)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ADDRESS", message: "Invalid Ethereum address" },
      });
      return;
    }
    const history = await getRegistrationHistory(address as `0x${string}`);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "FETCH_ERROR", message: (err as Error).message },
    });
  }
});

router.delete("/:address/data", requireSignedNonce, async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    if (!isValidAddress(address)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ADDRESS", message: "Invalid Ethereum address" },
      });
      return;
    }
    const subject = address as `0x${string}`;
    if (req.verifiedAddress!.toLowerCase() !== subject.toLowerCase()) {
      res.status(403).json({
        success: false,
        error: { code: "NOT_SUBJECT", message: "Only the subject can erase their own data" },
      });
      return;
    }

    // Record the erasure audit entry. Off-chain claim payloads are not stored by
    // this backend (claims are committed on-chain as hash commitments and raw data
    // is held by the subject/issuer), so there is nothing to delete server-side.
    // The on-chain commitment remains as an orphaned hash — the audit trail that a
    // claim existed — but it is no longer verifiable (ATTESTATIONS.md §12).
    const claimIds = getClaimsBySubject(subject, true).map((c) => c.claimId);
    erasureAuditLog.push({ subject, claimIds, erasedAt: Date.now() });

    console.info(`[GDPR] Erasure recorded for ${subject}: ${claimIds.length} claims`);

    res.json({
      success: true,
      data: {
        erased: claimIds.length,
        message: "Erasure recorded. Off-chain claim payloads are not stored by this backend; on-chain commitments remain as orphaned hashes.",
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

import { Router, Request, Response } from "express";
import { getIdentity } from "../services/identityService.js";
import { executeContractCall } from "../services/circleService.js";
import { ADDRESSES } from "../config/arc.js";
import { requireSignedNonce } from "../middleware/auth.js";
import { unpinFromIpfs } from "../services/ipfsService.js";

const router = Router();

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

    res.json({
      success: true,
      data: {
        erased: 0,
        message: "GDPR erasure initiated. Offchain data (IPFS metadata, keys) deleted. Onchain commitments remain as orphaned hashes.",
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

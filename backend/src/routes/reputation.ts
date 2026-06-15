import { Router, Request, Response } from "express";
import { getIdentity } from "../services/identityService.js";
import { getReputationEvents, recordReputationEvent } from "../services/reputationService.js";
import { requireSignedNonce } from "../middleware/auth.js";

const router = Router();

router.get("/:address", async (req: Request, res: Response) => {
  try {
    const identity = await getIdentity(req.params.address as `0x${string}`);
    if (!identity) {
      res.json({ success: true, data: { reputation: [] } });
      return;
    }

    const events = await getReputationEvents(identity.tokenId);
    res.json({ success: true, data: { tokenId: identity.tokenId, events: events.map(Number) } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "FETCH_ERROR", message: (err as Error).message },
    });
  }
});

router.post("/record", requireSignedNonce, async (req: Request, res: Response) => {
  try {
    const { identityTokenId, eventType, metadataURI } = req.body;
    if (!identityTokenId || !eventType) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "identityTokenId and eventType required" },
      });
      return;
    }

    const txHash = await recordReputationEvent(identityTokenId, eventType, metadataURI ?? "");
    res.json({ success: true, data: { txHash } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "RECORD_FAILED", message: (err as Error).message },
    });
  }
});

export default router;

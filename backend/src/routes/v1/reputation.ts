import { Router, Request, Response } from "express";
import { ReputationAttestationService } from "../../services/attestation/reputation/ReputationAttestationService.js";
import { getPassport } from "../../services/passportService.js";
import { requireSignedNonce } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress } from "../../utils/address.js";
import { RecordReputationBody, InteractionBody, DisputeBody } from "../../openapi/schemas.js";
import { waitForIndexerReady } from "../../indexer/claimIndexer.js";

const router = Router();
const reputation = new ReputationAttestationService();

router.post("/record", requireSignedNonce, validateBody(RecordReputationBody), async (req: Request, res: Response) => {
  try {
    const { subject, score, domain, dataPoints, expiresAt } = req.body as {
      subject: string; score: bigint; domain: string; dataPoints: number; expiresAt?: number;
    };
    const txHash = await reputation.issueScore(asAddress(subject), score, domain, dataPoints, expiresAt ?? 0);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "REPUTATION_RECORD_FAILED", message: (err as Error).message } });
  }
});

router.post("/interaction", requireSignedNonce, validateBody(InteractionBody), async (req: Request, res: Response) => {
  try {
    const { subject, context, counterparty, platform } = req.body as {
      subject: string; context: string; counterparty: string; platform: string;
    };
    const txHash = await reputation.issuePositiveInteraction(asAddress(subject), context, asAddress(counterparty), platform);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "INTERACTION_FAILED", message: (err as Error).message } });
  }
});

router.post("/dispute", requireSignedNonce, validateBody(DisputeBody), async (req: Request, res: Response) => {
  try {
    const { subject, type, reportedBy, evidence, resolvedAt } = req.body as {
      subject: string; type: string; reportedBy: string; evidence: string; resolvedAt: number;
    };
    const txHash = await reputation.issueDispute(asAddress(subject), type, asAddress(reportedBy), evidence, resolvedAt);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "DISPUTE_FAILED", message: (err as Error).message } });
  }
});

router.get("/score/:address", async (req: Request, res: Response) => {
  try {
    await waitForIndexerReady();
    const address = req.params.address as `0x${string}`;
    const passport = await getPassport(address);
    const svc = passport.services.reputation;
    res.json({
      success: true,
      data: { address, service: "reputation", verified: svc.verified, claimCount: svc.claimCount, claims: svc.claims },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

router.get("/history/:address", async (req: Request, res: Response) => {
  try {
    await waitForIndexerReady();
    const address = req.params.address as `0x${string}`;
    const passport = await getPassport(address);
    const svc = passport.services.reputation;
    res.json({
      success: true,
      data: { address, service: "reputation", verified: svc.verified, claimCount: svc.claimCount, claims: svc.claims, history: svc.claims },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

export default router;

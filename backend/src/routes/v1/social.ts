import { Router, Request, Response } from "express";
import { SocialAttestationService } from "../../services/attestation/social/SocialAttestationService.js";
import { getPassport } from "../../services/passportService.js";
import { requireSignedNonce } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress } from "../../utils/address.js";
import { LinkAccountBody, HumanityBody, FollowerMilestoneBody } from "../../openapi/schemas.js";
import { waitForIndexerReady } from "../../indexer/claimIndexer.js";

const router = Router();
const social = new SocialAttestationService();

router.post("/link", requireSignedNonce, validateBody(LinkAccountBody), async (req: Request, res: Response) => {
  try {
    const { subject, platform: p, handle, profileId, expiresAt } = req.body as {
      subject: string; platform: string; handle: string; profileId: string; expiresAt?: number;
    };
    const txHash = await social.linkAccount(asAddress(subject), p, handle, profileId, expiresAt ?? 0);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "SOCIAL_LINK_FAILED", message: (err as Error).message } });
  }
});

router.post("/humanity", requireSignedNonce, validateBody(HumanityBody), async (req: Request, res: Response) => {
  try {
    const { subject, verified, mechanism, nullifier } = req.body as {
      subject: string; verified: true; mechanism: string; nullifier: string;
    };
    const txHash = await social.issueHumanityProof(asAddress(subject), verified, mechanism, nullifier as `0x${string}`);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "HUMANITY_FAILED", message: (err as Error).message } });
  }
});

router.post("/follower-milestone", requireSignedNonce, validateBody(FollowerMilestoneBody), async (req: Request, res: Response) => {
  try {
    const { subject, platform: p, followerCount, milestone } = req.body as {
      subject: string; platform: string; followerCount: number; milestone: number;
    };
    const txHash = await social.issueFollowerMilestone(asAddress(subject), p, followerCount, milestone);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "MILESTONE_FAILED", message: (err as Error).message } });
  }
});

router.get("/:address", async (req: Request, res: Response) => {
  try {
    await waitForIndexerReady();
    const address = req.params.address as `0x${string}`;
    const passport = await getPassport(address);
    const svc = passport.services.social;
    res.json({
      success: true,
      data: { address, service: "social", verified: svc.verified, claimCount: svc.claimCount, claims: svc.claims },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

export default router;

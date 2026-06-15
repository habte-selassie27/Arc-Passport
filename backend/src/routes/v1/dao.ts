import { Router, Request, Response } from "express";
import { DaoAttestationService } from "../../services/attestation/dao/DaoAttestationService.js";
import { requireSignedNonce } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress } from "../../utils/address.js";
import { EnrollBody, ParticipationBody, DelegateBody } from "../../openapi/schemas.js";

const router = Router();
const dao = new DaoAttestationService();

router.post("/enroll", requireSignedNonce, validateBody(EnrollBody), async (req: Request, res: Response) => {
  try {
    const { subject, daoName, daoAddress, role, votingWeight } = req.body as {
      subject: string; daoName: string; daoAddress: string; role: string; votingWeight?: bigint;
    };
    const txHash = await dao.issueMembership(asAddress(subject), daoName, asAddress(daoAddress), role, votingWeight ?? 0n);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "DAO_ENROLL_FAILED", message: (err as Error).message } });
  }
});

router.post("/participation/update", requireSignedNonce, validateBody(ParticipationBody), async (req: Request, res: Response) => {
  try {
    const { subject, daoAddress, proposalsPassed, votesParticipated, delegatesCount } = req.body as {
      subject: string; daoAddress: string; proposalsPassed: number; votesParticipated: number; delegatesCount: number;
    };
    const txHash = await dao.issueParticipation(asAddress(subject), asAddress(daoAddress), proposalsPassed, votesParticipated, delegatesCount);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "PARTICIPATION_FAILED", message: (err as Error).message } });
  }
});

router.post("/delegate", requireSignedNonce, validateBody(DelegateBody), async (req: Request, res: Response) => {
  try {
    const { subject, daoAddress, delegatedFrom, statement } = req.body as {
      subject: string; daoAddress: string; delegatedFrom: string[]; statement: string;
    };
    const txHash = await dao.issueDelegate(asAddress(subject), asAddress(daoAddress), delegatedFrom.map(asAddress), statement);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "DELEGATE_FAILED", message: (err as Error).message } });
  }
});

router.get("/member/:address", async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { address: req.params.address, service: "dao" } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

export default router;

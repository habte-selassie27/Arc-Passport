import { Router, Request, Response } from "express";
import { EmploymentAttestationService } from "../../services/attestation/employment/EmploymentAttestationService.js";
import { requireSignedNonce } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress } from "../../utils/address.js";
import { IssueEmploymentBody, IncomeBody, ContractorBody } from "../../openapi/schemas.js";

const router = Router();
const employment = new EmploymentAttestationService();

router.post("/issue", requireSignedNonce, validateBody(IssueEmploymentBody), async (req: Request, res: Response) => {
  try {
    const { subject, employer, role, startDate, endDate, employerDid } = req.body as {
      subject: string; employer: string; role: string; startDate: number; endDate: number; employerDid: string;
    };
    const txHash = await employment.issueEmployment(asAddress(subject), employer, role, startDate, endDate, employerDid);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "EMPLOYMENT_FAILED", message: (err as Error).message } });
  }
});

router.post("/income", requireSignedNonce, validateBody(IncomeBody), async (req: Request, res: Response) => {
  try {
    const { subject, currency, bandMin, bandMax, provider: p, expiresAt } = req.body as {
      subject: string; currency: string; bandMin: bigint; bandMax: bigint; provider: string; expiresAt?: number;
    };
    const txHash = await employment.issueIncomeBand(asAddress(subject), currency, bandMin, bandMax, p, expiresAt ?? 0);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "INCOME_FAILED", message: (err as Error).message } });
  }
});

router.post("/contractor", requireSignedNonce, validateBody(ContractorBody), async (req: Request, res: Response) => {
  try {
    const { subject, platform, completedJobs, totalEarned, rating } = req.body as {
      subject: string; platform: string; completedJobs: number; totalEarned: bigint; rating: number;
    };
    const txHash = await employment.issueContractor(asAddress(subject), platform, completedJobs, totalEarned, rating);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "CONTRACTOR_FAILED", message: (err as Error).message } });
  }
});

router.get("/:address", async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { address: req.params.address, service: "employment" } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

export default router;

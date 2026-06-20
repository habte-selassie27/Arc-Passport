import { Router, Request, Response } from "express";
import { KycAttestationService } from "../../services/attestation/kyc/KycAttestationService.js";
import { getPassport } from "../../services/passportService.js";
import { requireSignedNonce } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress } from "../../utils/address.js";
import { BasicKycBody, AmlBody, AccreditedBody, AgeGateBody } from "../../openapi/schemas.js";
import { waitForIndexerReady } from "../../indexer/claimIndexer.js";

const router = Router();
const kyc = new KycAttestationService();

router.post("/issue", requireSignedNonce, validateBody(BasicKycBody), async (req: Request, res: Response) => {
  try {
    const { subject, level, country, provider: p, expiresAt: exp } = req.body as {
      subject: string; level: number; country: string; provider: string; expiresAt?: number;
    };
    const txHash = await kyc.issueBasicKyc(asAddress(subject), level, country, p, exp ?? 0);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "KYC_ISSUE_FAILED", message: (err as Error).message } });
  }
});

router.post("/aml/issue", requireSignedNonce, validateBody(AmlBody), async (req: Request, res: Response) => {
  try {
    const { subject, passed, provider: p } = req.body as { subject: string; passed: boolean; provider: string };
    const txHash = await kyc.issueAmlScreening(asAddress(subject), passed, p);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "AML_FAILED", message: (err as Error).message } });
  }
});

router.post("/accredited", requireSignedNonce, validateBody(AccreditedBody), async (req: Request, res: Response) => {
  try {
    const { subject, jurisdiction, validUntil, provider: p } = req.body as {
      subject: string; jurisdiction: string; validUntil: number; provider: string;
    };
    const txHash = await kyc.issueAccreditedInvestor(asAddress(subject), jurisdiction, validUntil, p);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "ACCREDITED_FAILED", message: (err as Error).message } });
  }
});

router.post("/age-gate", requireSignedNonce, validateBody(AgeGateBody), async (req: Request, res: Response) => {
  try {
    const { subject, over18, provider: p } = req.body as { subject: string; over18: true; provider: string };
    const txHash = await kyc.issueAgeGate(asAddress(subject), over18, p);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "AGE_GATE_FAILED", message: (err as Error).message } });
  }
});

router.get("/status/:address", async (req: Request, res: Response) => {
  try {
    await waitForIndexerReady();
    const address = req.params.address as `0x${string}`;
    const passport = await getPassport(address);
    const kycService = passport.services.kyc;
    res.json({
      success: true,
      data: {
        address,
        service: "kyc",
        verified: kycService.verified,
        claimCount: kycService.claimCount,
        claims: kycService.claims,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

export default router;

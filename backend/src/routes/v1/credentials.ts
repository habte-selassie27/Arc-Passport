import { Router, Request, Response } from "express";
import { CredentialAttestationService } from "../../services/attestation/credentials/CredentialAttestationService.js";
import { requireSignedNonce } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress } from "../../utils/address.js";
import { CertifyBody, LicenseBody, EndorseBody } from "../../openapi/schemas.js";

const router = Router();
const credentials = new CredentialAttestationService();

router.post("/certify", requireSignedNonce, validateBody(CertifyBody), async (req: Request, res: Response) => {
  try {
    const { subject, certName, issuingBody, certId, validUntil } = req.body as {
      subject: string; certName: string; issuingBody: string; certId: string; validUntil?: number;
    };
    const txHash = await credentials.issueCertification(asAddress(subject), certName, issuingBody, certId, validUntil ?? 0);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "CERTIFY_FAILED", message: (err as Error).message } });
  }
});

router.post("/license", requireSignedNonce, validateBody(LicenseBody), async (req: Request, res: Response) => {
  try {
    const { subject, licenseType, licenseNumber, jurisdiction: j, issuingBody, validUntil } = req.body as {
      subject: string; licenseType: string; licenseNumber: string; jurisdiction: string; issuingBody: string; validUntil?: number;
    };
    const txHash = await credentials.issueLicense(asAddress(subject), licenseType, licenseNumber, j, issuingBody, validUntil ?? 0);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "LICENSE_FAILED", message: (err as Error).message } });
  }
});

router.post("/endorse", requireSignedNonce, validateBody(EndorseBody), async (req: Request, res: Response) => {
  try {
    const { subject, skill, level, endorsedBy } = req.body as {
      subject: string; skill: string; level: number; endorsedBy?: string;
    };
    const txHash = await credentials.endorseSkill(asAddress(subject), skill, level, endorsedBy ? asAddress(endorsedBy) : asAddress(subject));
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "ENDORSE_FAILED", message: (err as Error).message } });
  }
});

router.get("/:address", async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { address: req.params.address, service: "credentials" } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

export default router;

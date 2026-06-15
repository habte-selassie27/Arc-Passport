import { Router, Request, Response } from "express";
import { IdentityAttestationService } from "../../services/attestation/identity/IdentityAttestationService.js";
import { requireSignedNonce } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress } from "../../utils/address.js";
import { RegisterIdentityBody, LivenessBody } from "../../openapi/schemas.js";

const router = Router();
const identity = new IdentityAttestationService();

router.post("/register", requireSignedNonce, validateBody(RegisterIdentityBody), async (req: Request, res: Response) => {
  try {
    const { subject, displayName, avatarCid, expiresAt } = req.body as {
      subject: string; displayName: string; avatarCid?: string; expiresAt?: number;
    };
    const txHash = await identity.issueBasicIdentity(asAddress(subject), displayName, avatarCid ?? "", expiresAt ?? 0);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    res.status(e.code === "ISSUER_NOT_CONFIGURED" ? 503 : 500).json({ success: false, error: { code: e.code ?? "IDENTITY_FAILED", message: e.message ?? "Identity issuance failed" } });
  }
});

router.post("/liveness", requireSignedNonce, validateBody(LivenessBody), async (req: Request, res: Response) => {
  try {
    const { subject, verified, provider: p, expiresAt } = req.body as {
      subject: string; verified: boolean; provider: string; expiresAt?: number;
    };
    const txHash = await identity.issueLivenessVerified(asAddress(subject), verified, p, expiresAt ?? 0);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "LIVENESS_FAILED", message: (err as Error).message } });
  }
});

router.get("/:address", async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { address: req.params.address, service: "identity" } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

export default router;

import { Router, Request, Response } from "express";
import { CustomAttestationService } from "../../services/attestation/custom/CustomAttestationService.js";
import type { AttestInput } from "../../services/attestation/base/BaseAttestationService.js";
import { getService } from "../../services/attestation/index.js";
import { computeSchemaId } from "../../utils/schemaHash.js";
import { getSchemaById } from "../../constants/schemas.js";
import { requireSignedNonce } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress, asSchemaId } from "../../utils/address.js";
import { RegisterSchemaBody, CustomAttestBody } from "../../openapi/schemas.js";

const router = Router();
const custom = new CustomAttestationService();

router.post("/schema/register", requireSignedNonce, validateBody(RegisterSchemaBody), async (req: Request, res: Response) => {
  try {
    const { name, version, fieldsJson } = req.body as { name: string; version: string; fieldsJson: string };
    const schemaId = computeSchemaId(name, version, fieldsJson);
    res.json({ success: true, data: { schemaId, name, version } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "SCHEMA_REGISTER_FAILED", message: (err as Error).message } });
  }
});

router.get("/schema/:schemaId", async (req: Request, res: Response) => {
  try {
    const id = req.params.schemaId as `0x${string}`;
    if (!/^0x[a-fA-F0-9]{64}$/.test(id)) {
      res.status(400).json({ success: false, error: { code: "INVALID_SCHEMA_ID", message: "Schema ID must be 0x + 64 hex chars" } });
      return;
    }
    const def = getSchemaById(id);
    if (!def) {
      res.status(404).json({ success: false, error: { code: "SCHEMA_NOT_FOUND", message: `Schema ${id} not found` } });
      return;
    }
    res.json({ success: true, data: def });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

router.post("/attest", requireSignedNonce, validateBody(CustomAttestBody), async (req: Request, res: Response) => {
  try {
    const { subject, schemaId, data, expiresAt } = req.body as { subject: string; schemaId: string; data: string; expiresAt?: number };
    const input: AttestInput = { subject: asAddress(subject), schemaId: asSchemaId(schemaId), data: data as `0x${string}`, expiresAt: expiresAt ?? 0 };
    const txHash = await custom.issueCustom(input);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "CUSTOM_ATTEST_FAILED", message: (err as Error).message } });
  }
});

router.get("/claims/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ success: false, error: { code: "INVALID_SUBJECT", message: "address must be 0x + 40 hex chars" } });
      return;
    }
    const claims = await getService("custom").getClaims(asAddress(address), null);
    res.json({ success: true, data: { address, claims } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

export default router;

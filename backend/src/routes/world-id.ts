import { Router } from "express";
import { requireSignedNonce } from "../middleware/auth.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import {
  signRpRequest,
  verifyAndAttest,
  getWorldIdStatus,
  getWorldIdConfig,
} from "../services/worldIdService.js";

const router = Router();

function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function handleError(res: any, err: unknown) {
  if (err instanceof ArcPassError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  } else {
    const e = err as Error;
    res.status(500).json({ success: false, error: { code: "WORLD_ID_ERROR", message: e.message } });
  }
}

/**
 * POST /world-id/rp-signature
 * Generate an RP signature for a World ID proof request.
 * The frontend needs this to create a valid IDKit widget request.
 */
router.post("/rp-signature", requireSignedNonce, async (req, res) => {
  try {
    const { action } = req.body;
    if (!action) throw Errors.MissingFields(["action"]);
    const sig = signRpRequest(action);
    res.json({ success: true, data: sig });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * POST /world-id/verify
 * Receive an IDKit proof, verify it via the World ID API, and issue
 * the on-chain Humanity Proof attestation.
 */
router.post("/verify", requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const { rpId, idkitResponse } = req.body;
    if (!rpId || !idkitResponse) throw Errors.MissingFields(["rpId", "idkitResponse"]);
    const result = await verifyAndAttest(subject, rpId, idkitResponse);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /world-id/status/:address
 * Public, read-only: is this address a verified unique human on-chain?
 */
router.get("/status/:address", async (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    if (!isValidAddress(address)) throw Errors.InvalidSubject(address);
    const status = await getWorldIdStatus(address);
    res.json({ success: true, data: status });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /world-id/config
 * Public metadata about the humanity verification mechanism.
 */
router.get("/config", (_req, res) => {
  try {
    res.json({ success: true, data: getWorldIdConfig() });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;

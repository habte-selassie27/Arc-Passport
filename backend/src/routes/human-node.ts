import { Router } from "express";
import { requireSignedNonce } from "../middleware/auth.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import {
  startVerification,
  handleCallback,
  getVerification,
  getHumanityStatus,
} from "../services/humanodeService.js";
import { ADDRESSES } from "../config/arc.js";
import { SOCIAL_SCHEMAS } from "../constants/schemas.js";

const router = Router();

function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function handleError(res: any, err: unknown) {
  if (err instanceof ArcPassError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  } else {
    const e = err as Error;
    res.status(500).json({ success: false, error: { code: "HUMANODE_ERROR", message: e.message } });
  }
}

/**
 * POST /human-node/start
 * Begin a Humanode verification session for the authenticated wallet.
 * Returns the Humanode OAuth authorize URL the client should open.
 */
router.post("/start", requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const result = await startVerification(subject);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /human-node/status/:verificationId
 * Poll the current state of a verification session.
 */
router.get("/status/:verificationId", requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const record = getVerification(req.params.verificationId);
    if (!record) throw Errors.VerificationNotFound(req.params.verificationId);
    if (record.subject.toLowerCase() !== subject.toLowerCase()) {
      throw Errors.VerificationMismatch();
    }
    res.json({ success: true, data: record });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * POST /human-node/callback
 * Complete verification: exchange the Humanode OAuth code and issue the
 * on-chain Humanity Proof attestation.
 */
router.post("/callback", requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const { code, state, verificationId } = req.body;
    if (!code || !state || !verificationId) {
      throw Errors.MissingFields(["code", "state", "verificationId"]);
    }
    const record = await handleCallback(verificationId, subject, code, state);
    res.json({ success: true, data: record });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /human-node/verify/:address
 * Public, read-only: is this address a verified unique human on-chain?
 */
router.get("/verify/:address", async (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    if (!isValidAddress(address)) throw Errors.InvalidSubject(address);
    const status = await getHumanityStatus(address);
    res.json({ success: true, data: status });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /human-node/config
 * Public metadata about the humanity verification mechanism.
 */
router.get("/config", (_req, res) => {
  try {
    res.json({
      success: true,
      data: {
        mechanism: "humanode",
        description:
          "Proof of Biometric Uniqueness (PoBU) via Humanode. ArcPass stores only a " +
          "commitment to `uniqueHuman = true` plus a cryptographic nullifier — never " +
          "raw biometrics or PII.",
        schemaId: SOCIAL_SCHEMAS.HUMANITY_PROOF.id,
        schemaName: SOCIAL_SCHEMAS.HUMANITY_PROOF.name,
        gateAddress: ADDRESSES.humanityGate ?? null,
        scoreWeight: 85,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;

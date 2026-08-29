import { Router } from "express";
import { requireSignedNonce } from "../middleware/auth.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import {
  createLivenessChallenge,
  getLivenessStatus,
} from "../services/livenessService.js";
import { verifyAndAttestViaOracle, isUserHuman } from "../services/humanityOracleService.js";

const router = Router();

function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function handleError(res: any, err: unknown) {
  if (err instanceof ArcPassError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  } else {
    const e = err as Error;
    res.status(500).json({ success: false, error: { code: "LIVENESS_ERROR", message: e.message } });
  }
}

/**
 * POST /liveness/challenge
 * Issue a fresh random action sequence bound to the authenticated wallet.
 */
router.post("/challenge", requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const challenge = createLivenessChallenge(subject);
    res.json({ success: true, data: challenge });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * POST /liveness/verify
 * Validate the performed sequence + evidence frames, compute biometric hash,
 * and submit to the HumanityOracle for on-chain attestation.
 *
 * Request body:
 *   challengeId: string — the challenge ID from /challenge
 *   steps: string[] — the action steps performed
 *   frames: string[] — evidence frames (data URLs, JPEG)
 *   landmarks: any[] — MediaPipe facial landmarks (478 points)
 */
router.post("/verify", requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const { challengeId, steps, frames, landmarks } = req.body ?? {};

    if (!challengeId || !Array.isArray(steps) || !Array.isArray(frames)) {
      throw Errors.MissingFields(["challengeId", "steps", "frames"]);
    }

    if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 153) {
      throw new ArcPassError(
        "MISSING_LANDMARKS",
        "Facial landmarks array required (minimum 153 points from MediaPipe)",
        400
      );
    }

    // Check if already verified (idempotent).
    const alreadyHuman = await isUserHuman(subject);
    if (alreadyHuman) {
      res.json({
        success: true,
        data: {
          claimId: undefined,
          txHash: "",
          isHuman: true,
          alreadyVerified: true,
        },
      });
      return;
    }

    // Full verification flow: validate challenge → compute biometric → submit to oracle.
    const result = await verifyAndAttestViaOracle({
      subject,
      challengeId,
      steps,
      frames,
      landmarks,
    });

    res.json({
      success: true,
      data: {
        claimId: result.claimId,
        txHash: result.txHash,
        isHuman: result.isHuman,
        biometricHash: result.biometricHash,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /liveness/status/:address
 * Public, read-only: is this address a verified unique human on-chain?
 */
router.get("/status/:address", async (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    if (!isValidAddress(address)) throw Errors.InvalidSubject(address);

    // Check oracle first, fall back to old liveness status.
    const oracleHuman = await isUserHuman(address);
    if (oracleHuman) {
      res.json({
        success: true,
        data: {
          subject: address,
          verified: true,
          onChain: true,
          mechanism: "humanity-oracle",
          source: "oracle",
        },
      });
      return;
    }

    // Fall back to legacy liveness check.
    const status = await getLivenessStatus(address);
    res.json({ success: true, data: status });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /liveness/config
 * Public metadata about the humanity verification mechanism.
 */
router.get("/config", (_req, res) => {
  try {
    res.json({
      success: true,
      data: {
        mechanism: "humanity-oracle",
        description:
          "Humanity verification via the Arc Humanity Oracle. " +
          "Camera liveness check → biometric hash → on-chain attestation. " +
          "One human = one wallet enforced via nullifier registry.",
        schemaId: null,
        schemaName: "Humanity Proof",
        gateAddress: process.env.HUMANITY_ORACLE_ADDRESS || null,
        scoreWeight: 85,
        features: {
          liveness: true,
          biometricUniqueness: true,
          onChainAttestation: true,
          crossWalletDedup: true,
        },
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;

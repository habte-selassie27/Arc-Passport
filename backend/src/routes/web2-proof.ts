import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireSignedNonce } from "../middleware/auth.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import {
  startVerification,
  handleProofSubmission,
  getVerification,
  getWeb2ProofStatus,
} from "../services/zkpassService.js";
import { SOCIAL_SCHEMAS } from "../constants/schemas.js";

const router = Router();
export default router;

// Write rate limit — matches v1 write limiter pattern (AGENTS.md §15.5.3)
const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => (req.headers["x-wallet-address"] as string) || req.ip || "unknown",
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests" } },
});

function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function handleError(res: any, err: unknown) {
  console.error("[web2-proof] Error:", (err as Error).message, (err as Error).stack?.slice(0, 300));
  if (err instanceof ArcPassError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  } else {
    res.status(500).json({ success: false, error: { code: "PROVIDER_ERROR", message: (err as Error).message || "Verification failed" } });
  }
}

// ── Public endpoints ──

router.get("/config", (_req, res) => {
  res.json({
    success: true,
    data: {
      provider: "zkpass",
      mechanism: "zktls",
      schemaId: SOCIAL_SCHEMAS.WEB2_DATA_PROOF.id,
      templates: [
        {
          id: "twitter-account",
          name: "X / Twitter Account",
          description: "Prove you own an X account",
          zkpassSchemaId: process.env.ZKPASS_TWITTER_SCHEMA_ID || "",
        },
        {
          id: "discord-account",
          name: "Discord Account",
          description: "Prove you own a Discord account",
          zkpassSchemaId: process.env.ZKPASS_DISCORD_SCHEMA_ID || "",
        },
        {
          id: "cex-balance",
          name: "CEX KYC Level",
          description: "Prove your KYC level on a centralized exchange",
          zkpassSchemaId: process.env.ZKPASS_CEX_SCHEMA_ID || "",
        },
        {
          id: "linkedin-account",
          name: "LinkedIn Account",
          description: "Prove you own a LinkedIn account",
          zkpassSchemaId: process.env.ZKPASS_LINKEDIN_SCHEMA_ID || "",
        },
        {
          id: "reddit-account",
          name: "Reddit Account",
          description: "Prove you own a Reddit account",
          zkpassSchemaId: process.env.ZKPASS_REDDIT_SCHEMA_ID || "",
        },
      ],
    },
  });
});

router.get("/verify/:address", async (req, res) => {
  try {
    const { address } = req.params;
    if (!isValidAddress(address)) {
      throw Errors.InvalidSubject(address);
    }
    const status = await getWeb2ProofStatus(address);
    res.json({ success: true, data: { subject: address, ...status } });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Authenticated endpoints ──

router.post("/start", writeLimiter, requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const { schemaId } = req.body;
    if (!schemaId) {
      throw Errors.MissingFields(["schemaId"]);
    }

    const result = await startVerification(subject, schemaId);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/proof", writeLimiter, requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const { verificationId, proof } = req.body;
    if (!verificationId || !proof) {
      throw Errors.MissingFields(["verificationId", "proof"]);
    }

    const record = await handleProofSubmission(verificationId, subject, proof);
    res.json({ success: true, data: record });
  } catch (err) {
    handleError(res, err);
  }
});

// Public endpoint — verificationId is a secret UUID, no wallet signature needed.
router.get("/status/:verificationId", async (req, res) => {
  try {
    const { verificationId } = req.params;
    const record = getVerification(verificationId);
    if (!record) {
      throw Errors.VerificationNotFound(verificationId);
    }
    res.json({ success: true, data: record });
  } catch (err) {
    handleError(res, err);
  }
});

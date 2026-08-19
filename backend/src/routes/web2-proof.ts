import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireSignedNonce } from "../middleware/auth.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import {
  startVerification,
  handleCallback,
  getVerification,
  getWeb2ProofStatus,
} from "../services/primusService.js";
import { getPrimusProvider } from "../services/primusProvider.js";
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
  if (err instanceof ArcPassError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  } else {
    res.status(500).json({ success: false, error: { code: "PROVIDER_ERROR", message: "Verification failed" } });
  }
}

// ── Public endpoints ──

router.get("/config", (_req, res) => {
  res.json({
    success: true,
    data: {
      provider: "primus",
      mechanism: "zktls",
      schemaId: SOCIAL_SCHEMAS.WEB2_DATA_PROOF.id,
      templates: [
        { id: "github-account", name: "GitHub Account", description: "Prove you own a GitHub account" },
        { id: "twitter-account", name: "X / Twitter Account", description: "Prove you own an X account" },
        { id: "discord-account", name: "Discord Account", description: "Prove you own a Discord account" },
        { id: "email-ownership", name: "Email Ownership", description: "Prove you own an email address" },
        { id: "cex-balance", name: "CEX Balance", description: "Prove a minimum balance on a centralized exchange" },
      ],
    },
  });
});

router.get("/verify/:address", async (req, res) => {
  try {
    const { address } = req.params;
    if (!isValidAddress(address)) {
      throw Errors.InvalidSubject();
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
    const { templateId } = req.body;
    if (!templateId) {
      throw Errors.MissingFields(["templateId"]);
    }

    const provider = getPrimusProvider();
    const result = await startVerification(subject, templateId, provider);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/status/:verificationId", requireSignedNonce, async (req, res) => {
  try {
    const { verificationId } = req.params;
    const subject = req.verifiedAddress!;
    const record = getVerification(verificationId);
    if (!record) {
      throw Errors.VerificationNotFound(verificationId);
    }
    if (record.subject.toLowerCase() !== subject.toLowerCase()) {
      throw Errors.VerificationMismatch();
    }
    res.json({ success: true, data: record });
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/callback", writeLimiter, requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const { taskId, verificationId } = req.body;
    if (!taskId || !verificationId) {
      throw Errors.MissingFields(["taskId", "verificationId"]);
    }

    const provider = getPrimusProvider();
    const record = await handleCallback(verificationId, subject, taskId, provider);
    res.json({ success: true, data: record });
  } catch (err) {
    handleError(res, err);
  }
});

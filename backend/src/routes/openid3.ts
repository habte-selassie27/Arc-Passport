import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireSignedNonce } from "../middleware/auth.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import {
  startLinking,
  handleOAuthCallback,
  getLink,
  getOpenID3Status,
} from "../services/openid3Service.js";
import { getOpenID3Provider, type OpenID3ProviderId } from "../services/openid3Provider.js";
import { SOCIAL_SCHEMAS } from "../constants/schemas.js";

const router = Router();
export default router;

const PROVIDER_IDS: OpenID3ProviderId[] = ["github", "twitter", "discord", "email"];

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
      provider: "openid3",
      mechanism: "oauth",
      schemaId: SOCIAL_SCHEMAS.OPENID3_IDENTITY.id,
      providers: [
        { id: "github", name: "GitHub", description: "Link your GitHub account", icon: "github" },
        { id: "twitter", name: "X / Twitter", description: "Link your X account", icon: "twitter" },
        { id: "discord", name: "Discord", description: "Link your Discord account", icon: "discord" },
        { id: "email", name: "Email", description: "Verify your email address", icon: "email" },
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
    const status = await getOpenID3Status(address);
    res.json({ success: true, data: { subject: address, ...status } });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Authenticated endpoints ──

router.post("/start", writeLimiter, requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const { providerId } = req.body;
    if (!providerId || !PROVIDER_IDS.includes(providerId)) {
      throw Errors.MissingFields(["providerId (github|twitter|discord|email)"]);
    }

    const provider = getOpenID3Provider();
    const result = await startLinking(subject, providerId, provider);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/status/:linkId", writeLimiter, requireSignedNonce, async (req, res) => {
  try {
    const { linkId } = req.params;
    const subject = req.verifiedAddress!;
    const record = getLink(linkId);
    if (!record) {
      throw Errors.VerificationNotFound(linkId);
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
    const { code, linkId } = req.body;
    if (!code || !linkId) {
      throw Errors.MissingFields(["code", "linkId"]);
    }

    const provider = getOpenID3Provider();
    const record = await handleOAuthCallback(linkId, subject, code, provider);
    res.json({ success: true, data: record });
  } catch (err) {
    handleError(res, err);
  }
});

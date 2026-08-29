import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireSignedNonce } from "../middleware/auth.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import {
  startLinking,
  handleDAuthCallback,
  getLink,
  getOpenID3Status,
} from "../services/openid3Service.js";
import { getOpenID3Provider, type OpenID3ProviderId } from "../services/openid3Provider.js";
import { SOCIAL_SCHEMAS } from "../constants/schemas.js";
import { type DAuthResult } from "../utils/dauthVerifier.js";

const router = Router();
export default router;

const PROVIDER_IDS: OpenID3ProviderId[] = ["github", "twitter", "discord"];

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
  const allProviders = [
    { id: "github", name: "GitHub", description: "Link your GitHub account", icon: "github", envKey: "OPENID3_GITHUB_CLIENT_ID" },
    { id: "twitter", name: "X / Twitter", description: "Link your X account", icon: "twitter", envKey: "OPENID3_TWITTER_CLIENT_ID" },
    { id: "discord", name: "Discord", description: "Link your Discord account", icon: "discord", envKey: "OPENID3_DISCORD_CLIENT_ID" },
  ];
  const providers = allProviders.map(({ envKey, ...p }) => ({
    ...p,
    configured: !!process.env[envKey],
  }));
  res.json({
    success: true,
    data: {
      provider: "openid3",
      mechanism: "dauth",
      schemaId: SOCIAL_SCHEMAS.OPENID3_IDENTITY.id,
      providers,
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
      throw Errors.MissingFields(["providerId (github|twitter|discord)"]);
    }

    const provider = getOpenID3Provider();
    const result = await startLinking(subject, providerId, provider);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/status/:linkId", async (req, res) => {
  try {
    const { linkId } = req.params;
    const record = getLink(linkId);
    if (!record) {
      throw Errors.VerificationNotFound(linkId);
    }
    res.json({ success: true, data: record });
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/callback", writeLimiter, requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const { dauthResult, linkId } = req.body as { dauthResult: DAuthResult; linkId: string };
    if (!dauthResult || !linkId) {
      throw Errors.MissingFields(["dauthResult (DAuth proof/JWT)", "linkId"]);
    }

    const provider = getOpenID3Provider();
    const record = await handleDAuthCallback(linkId, subject, dauthResult, provider);
    res.json({ success: true, data: record });
  } catch (err) {
    handleError(res, err);
  }
});

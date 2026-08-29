import { Router } from "express";
import { randomUUID, createHash, randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import rateLimit from "express-rate-limit";
import { requireSignedNonce } from "../middleware/auth.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import {
  startLinking,
  handleDAuthCallback,
  handleOAuthCallback,
  exchangeOAuthCode,
  getLink,
  getOpenID3Status,
} from "../services/openid3Service.js";
import { getOpenID3Provider, getOAuthConfig, type OpenID3ProviderId } from "../services/openid3Provider.js";
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

// Direct OAuth callback — exchanges code server-side (bypasses DAuth)
router.post("/oauth-callback", writeLimiter, requireSignedNonce, async (req, res) => {
  try {
    const subject = req.verifiedAddress!;
    const { code, linkId } = req.body as { code: string; linkId: string };
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

// ── Server-side Twitter OAuth flow ──
// The full redirect chain (Twitter → backend → frontend) happens server-side.
// This avoids frontend redirect encoding issues and keeps PKCE entirely server-side.

const FRONTEND_URL = process.env.OPENID3_REDIRECT_BASE || "https://arc-passport.vercel.app";

// Step 1: Frontend hits this endpoint → backend redirects to Twitter
router.get("/twitter/start", async (req, res) => {
  try {
    const linkId = req.query.linkId as string;
    if (!linkId) {
      res.status(400).json({ success: false, error: { code: "MISSING_LINK_ID", message: "linkId query param required" } });
      return;
    }

    const record = getLink(linkId);
    if (!record) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Link record not found" } });
      return;
    }

    const config = getOAuthConfig().twitter;
    if (!config.clientId) {
      res.status(500).json({ success: false, error: { code: "NOT_CONFIGURED", message: "Twitter not configured" } });
      return;
    }

    // Generate PKCE
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

    // Update link record with code_verifier
    record.codeVerifier = codeVerifier;
    record.updatedAt = Date.now();
    persistLink(record);

    // Backend redirect URI (Twitter redirects back to our backend, not frontend)
    const backendBase = process.env.BACKEND_URL || "https://arc-passport.onrender.com";
    const redirectUri = `${backendBase}/openid3/twitter/callback`;

    // Build Twitter auth URL
    const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", config.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", linkId);
    authUrl.searchParams.set("scope", "tweet.read users.read offline.access");
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    res.redirect(authUrl.toString());
  } catch (err) {
    res.redirect(`${FRONTEND_URL}/openid3?error=${encodeURIComponent((err as Error).message)}`);
  }
});

// Step 2: Twitter redirects here → backend exchanges code → redirects to frontend
router.get("/twitter/callback", async (req, res) => {
  const linkId = req.query.state as string;
  const code = req.query.code as string;
  const providerError = req.query.error as string;

  if (providerError || !code || !linkId) {
    res.redirect(`${FRONTEND_URL}/openid3?error=${providerError || "missing_code"}`);
    return;
  }

  try {
    const record = getLink(linkId);
    if (!record) {
      res.redirect(`${FRONTEND_URL}/openid3?error=link_not_found`);
      return;
    }

    if (!record.codeVerifier) {
      res.redirect(`${FRONTEND_URL}/openid3?error=missing_code_verifier`);
      return;
    }

    // Exchange code for token + fetch user info
    const providerUser = await exchangeOAuthCode("twitter", code, record);

    // Import the full attestation flow
    const { keccak256, encodePacked } = await import("viem");
    const circleService = await import("../services/circleService.js");
    const executeContractCall = circleService.executeContractCall;

    const subject = record.subject as `0x${string}`;

    // Compute nullifier
    const nullifier = keccak256(
      encodePacked(["string", "string"], ["twitter", providerUser.id])
    );

    // Update record
    const now = Date.now();
    const IDENTITY_TTL_SECONDS = 365 * 24 * 60 * 60;
    const linkedAt = Math.floor(now / 1000);
    const expiresAt = linkedAt + IDENTITY_TTL_SECONDS;

    record.state = "linked";
    record.accountHandle = providerUser.handle;
    record.accountId = providerUser.id;
    record.nullifier = nullifier;
    record.updatedAt = now;

    // Data commitment
    const dataCommitment = keccak256(
      encodePacked(
        ["address", "bytes32", "string", "bool", "uint64"],
        [subject, nullifier, "twitter", true, BigInt(linkedAt)]
      )
    );

    // Issue on-chain attestation
    const walletId = process.env.CIRCLE_OPENID3_ISSUER_WALLET_ID;
    const registryAddress = process.env.ATTESTATION_REGISTRY_ADDRESS;
    const OPENID3_IDENTITY_ID = SOCIAL_SCHEMAS.OPENID3_IDENTITY.id!;

    if (walletId && registryAddress) {
      record.state = "attesting";
      // Persist intermediate state
      persistLink(record);

      try {
        const txHash = await executeContractCall(
          walletId,
          registryAddress as `0x${string}`,
          "attest(address,bytes32,bytes32,uint256)",
          [subject, OPENID3_IDENTITY_ID, dataCommitment, expiresAt.toString()]
        );

        // Recover claimId
        const arcService = await import("../services/arcService.js");
        const abis = await import("../abis/AttestationRegistry.js");
        const publicClient = arcService.publicClient;
        const ATTESTATION_REGISTRY_ABI = abis.ATTESTATION_REGISTRY_ABI;
        let claimId: string | undefined;
        try {
          const issuers = (await publicClient.readContract({
            address: registryAddress as `0x${string}`,
            abi: ATTESTATION_REGISTRY_ABI,
            functionName: "getIssuers",
          })) as `0x${string}`[];
          for (const issuer of issuers) {
            const cid = (await publicClient.readContract({
              address: registryAddress as `0x${string}`,
              abi: ATTESTATION_REGISTRY_ABI,
              functionName: "getActiveClaim",
              args: [subject, OPENID3_IDENTITY_ID, issuer],
            })) as `0x${string}`;
            if (cid && cid !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
              claimId = cid;
              break;
            }
          }
        } catch { /* best-effort */ }

        record.state = "complete";
        record.claimId = claimId ?? undefined;
        record.txHash = txHash;
      } catch (err) {
        record.state = "failed";
        record.error = (err as Error).message;
      }
    } else {
      record.state = "complete";
    }

    record.updatedAt = Date.now();
    persistLink(record);

    res.redirect(`${FRONTEND_URL}/openid3?success=true&provider=twitter`);
  } catch (err) {
    res.redirect(`${FRONTEND_URL}/openid3?error=${encodeURIComponent((err as Error).message)}`);
  }
});

function persistLink(record: any) {
  const storePath = join(process.cwd(), ".openid3-links.jsonl");
  try {
    const lines = existsSync(storePath) ? readFileSync(storePath, "utf8").split("\n").filter(Boolean) : [];
    const idx = lines.findIndex((l: string) => {
      try { return JSON.parse(l).linkId === record.linkId; } catch { return false; }
    });
    if (idx >= 0) lines[idx] = JSON.stringify(record);
    else lines.push(JSON.stringify(record));
    writeFileSync(storePath, lines.join("\n") + "\n");
  } catch { /* advisory */ }
}

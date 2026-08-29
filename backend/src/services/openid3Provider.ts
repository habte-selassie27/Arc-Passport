import { randomUUID, createHash, randomBytes } from "crypto";
import { type DAuthProof, type DAuthResult, type VerifiedIdentity, extractIdentity, verifyProof } from "../utils/dauthVerifier.js";

// ── Types ──

export type OpenID3ProviderId = "github" | "twitter" | "discord";

export interface OAuthParams {
  subject: `0x${string}`;
  providerId: OpenID3ProviderId;
  redirectUri?: string;
  linkId?: string;
}

export interface OAuthSession {
  sessionId: string;
  authUrl: string;
  expiresAt: number;
  codeVerifier?: string; // PKCE code_verifier (stored for token exchange)
}

export interface VerifyResult {
  valid: boolean;
  identity?: VerifiedIdentity;
  error?: string;
}

// ── Provider Interface ──

export interface OpenID3Provider {
  createOAuthSession(params: OAuthParams): Promise<OAuthSession>;
  verifyDAuthResult(result: DAuthResult, providerId: OpenID3ProviderId): Promise<VerifyResult>;
  isConfigured(): boolean;
}

// ── OAuth URL Config ──
// Each provider needs a registered OAuth app. The client IDs below are for
// development. In production, register your own apps and set env vars.

interface ProviderOAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl?: string;
  scope: string;
  extraParams?: Record<string, string>;
  requiresPkce?: boolean;
}

function getOAuthConfig(): Record<OpenID3ProviderId, ProviderOAuthConfig> {
  return {
    github: {
      clientId: process.env.OPENID3_GITHUB_CLIENT_ID || "",
      clientSecret: process.env.OPENID3_GITHUB_CLIENT_SECRET || "",
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      scope: "read:user user:email",
    },
    twitter: {
      clientId: process.env.OPENID3_TWITTER_CLIENT_ID || "",
      clientSecret: process.env.OPENID3_TWITTER_CLIENT_SECRET || "",
      authorizeUrl: "https://twitter.com/i/oauth2/authorize",
      tokenUrl: "https://api.twitter.com/2/oauth2/token",
      scope: "users.read",
      requiresPkce: true,
      extraParams: { response_type: "code" },
    },
    discord: {
      clientId: process.env.OPENID3_DISCORD_CLIENT_ID || "",
      clientSecret: process.env.OPENID3_DISCORD_CLIENT_SECRET || "",
      authorizeUrl: "https://discord.com/api/oauth2/authorize",
      tokenUrl: "https://discord.com/api/oauth2/token",
      scope: "identify email",
      extraParams: { response_type: "code" },
    },
  };
}

// ── PKCE Helpers ──

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// Exported for direct token exchange
export { getOAuthConfig };

// ── DAuth-Aware Provider ──

export class DAuthProvider implements OpenID3Provider {
  private redirectBase: string;

  constructor(redirectBase: string) {
    this.redirectBase = redirectBase;
  }

  isConfigured(): boolean {
    const config = getOAuthConfig();
    return !!(config.github.clientId || config.twitter.clientId || config.discord.clientId);
  }

  async createOAuthSession(params: OAuthParams): Promise<OAuthSession> {
    const sessionId = randomUUID();
    const config = getOAuthConfig()[params.providerId];

    if (!config.clientId) {
      throw new Error(
        `Provider ${params.providerId} is not configured. ` +
        `Set OPENID3_${params.providerId.toUpperCase()}_CLIENT_ID in your .env.`
      );
    }

    // Twitter requires HTTPS — use the env var if provided.
    const redirectBase = params.providerId === "twitter"
      ? (process.env.OPENID3_TWITTER_REDIRECT_BASE || this.redirectBase)
      : this.redirectBase;

    const redirectUri = `${redirectBase}/openid3/callback`;
    const state = `${params.linkId || sessionId}:${params.subject}:${params.providerId}`;

    const authUrl = new URL(config.authorizeUrl);
    authUrl.searchParams.set("client_id", config.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", config.scope);
    if (config.extraParams) {
      for (const [k, v] of Object.entries(config.extraParams)) {
        authUrl.searchParams.set(k, v);
      }
    }

    // Twitter requires PKCE — generate code_verifier + code_challenge
    let codeVerifier: string | undefined;
    if (config.requiresPkce) {
      codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
    }

    return {
      sessionId,
      authUrl: authUrl.toString(),
      expiresAt: Date.now() + 600_000,
      codeVerifier,
    };
  }

  async verifyDAuthResult(result: DAuthResult, providerId: OpenID3ProviderId): Promise<VerifyResult> {
    try {
      // Verify proof if present
      if (result.mode === "proof" || result.mode === "both") {
        const proof = result.mode === "proof"
          ? (result.data as DAuthProof)
          : (result.data as { proof: DAuthProof }).proof;
        if (!(await verifyProof(proof))) {
          return { valid: false, error: "DAuth proof signature verification failed" };
        }
      }

      const identity = await extractIdentity(result, providerId);
      return { valid: true, identity };
    } catch (err) {
      return { valid: false, error: `DAuth verification error: ${(err as Error).message}` };
    }
  }
}

// ── Mock Provider (tests only) ──

export class MockOpenID3Provider implements OpenID3Provider {
  isConfigured(): boolean {
    return true;
  }

  async createOAuthSession(params: OAuthParams): Promise<OAuthSession> {
    return {
      sessionId: `mock-session-${Date.now()}`,
      authUrl: `https://mock-oauth.example.com/auth?subject=${params.subject}&provider=${params.providerId}`,
      expiresAt: Date.now() + 3600_000,
    };
  }

  async verifyDAuthResult(_result: DAuthResult, _providerId: OpenID3ProviderId): Promise<VerifyResult> {
    return {
      valid: true,
      identity: {
        provider: "mock-oauth",
        accountHandle: "test-user",
        accountId: "mock-account-123",
        verified: true,
      },
    };
  }
}

// ── Factory ──

export function getOpenID3Provider(): OpenID3Provider {
  const redirectBase = process.env.OPENID3_REDIRECT_BASE || "http://localhost:5173";
  const provider = new DAuthProvider(redirectBase);
  if (provider.isConfigured()) return provider;
  throw new Error(
    "OpenID3 providers not configured. Set OPENID3_*_CLIENT_ID env vars for at least one provider (GitHub, Twitter, Discord)."
  );
}

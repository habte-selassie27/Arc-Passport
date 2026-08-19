import { randomUUID } from "crypto";

// ── Types ──

export type OpenID3ProviderId = "github" | "twitter" | "discord" | "email";

export interface OAuthParams {
  subject: `0x${string}`;
  providerId: OpenID3ProviderId;
  redirectUri?: string;
}

export interface OAuthSession {
  sessionId: string;
  authUrl: string;
  expiresAt: number;
}

export interface UserInfoResult {
  provider: string;
  accountHandle: string;
  accountId: string;
  verified: boolean;
  profileData?: Record<string, unknown>;
}

// ── Provider Interface ──

export interface OpenID3Provider {
  createOAuthSession(params: OAuthParams): Promise<OAuthSession>;
  exchangeCode(code: string, sessionId: string): Promise<UserInfoResult>;
  isConfigured(): boolean;
}

// ── Real OAuth Provider ──

interface OAuthConfig {
  github?: { clientId: string; clientSecret: string };
  twitter?: { clientId: string; clientSecret: string };
  discord?: { clientId: string; clientSecret: string };
  email?: { smtpHost: string; smtpUser: string; smtpPass: string };
}

function envConfig(): OAuthConfig {
  return {
    github: process.env.OPENID3_GITHUB_CLIENT_ID
      ? { clientId: process.env.OPENID3_GITHUB_CLIENT_ID, clientSecret: process.env.OPENID3_GITHUB_CLIENT_SECRET || "" }
      : undefined,
    twitter: process.env.OPENID3_TWITTER_CLIENT_ID
      ? { clientId: process.env.OPENID3_TWITTER_CLIENT_ID, clientSecret: process.env.OPENID3_TWITTER_CLIENT_SECRET || "" }
      : undefined,
    discord: process.env.OPENID3_DISCORD_CLIENT_ID
      ? { clientId: process.env.OPENID3_DISCORD_CLIENT_ID, clientSecret: process.env.OPENID3_DISCORD_CLIENT_SECRET || "" }
      : undefined,
  };
}

const OAUTH_ENDPOINTS: Record<string, { authorize: string; token: string; userInfo: string }> = {
  github: {
    authorize: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
    userInfo: "https://api.github.com/user",
  },
  twitter: {
    authorize: "https://twitter.com/i/oauth2/authorize",
    token: "https://api.twitter.com/2/oauth2/token",
    userInfo: "https://api.twitter.com/2/users/me",
  },
  discord: {
    authorize: "https://discord.com/api/oauth2/authorize",
    token: "https://discord.com/api/oauth2/token",
    userInfo: "https://discord.com/api/users/@me",
  },
};

export class OpenID3OAuthProvider implements OpenID3Provider {
  private config: OAuthConfig;
  private redirectBase: string;

  constructor(config: OAuthConfig, redirectBase: string) {
    this.config = config;
    this.redirectBase = redirectBase;
  }

  isConfigured(): boolean {
    return !!(this.config.github || this.config.twitter || this.config.discord);
  }

  async createOAuthSession(params: OAuthParams): Promise<OAuthSession> {
    const sessionId = randomUUID();
    const cfg = this.config[params.providerId];
    const endpoints = OAUTH_ENDPOINTS[params.providerId];
    if (!cfg || !endpoints) {
      throw new Error(`Provider ${params.providerId} is not configured`);
    }
    if (!("clientId" in cfg)) {
      throw new Error(`Provider ${params.providerId} is not configured`);
    }

    const redirectUri = params.redirectUri || `${this.redirectBase}/openid3/callback`;
    const state = `${sessionId}:${params.subject}`;

    const authUrl = new URL(endpoints.authorize);
    authUrl.searchParams.set("client_id", cfg.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    if (params.providerId === "github") {
      authUrl.searchParams.set("scope", "read:user user:email");
    } else if (params.providerId === "twitter") {
      authUrl.searchParams.set("scope", "users.read tweet.read");
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("code_challenge", sessionId);
      authUrl.searchParams.set("code_challenge_method", "S256");
    } else if (params.providerId === "discord") {
      authUrl.searchParams.set("scope", "identify email");
      authUrl.searchParams.set("response_type", "code");
    }

    return {
      sessionId,
      authUrl: authUrl.toString(),
      expiresAt: Date.now() + 600_000, // 10 minutes
    };
  }

  async exchangeCode(_code: string, _sessionId: string): Promise<UserInfoResult> {
    // In production, exchange the OAuth code for a token and fetch user info.
    // This is a placeholder — real implementation depends on the specific provider.
    throw new Error("OAuth code exchange not implemented — use MockOpenID3Provider for tests");
  }
}

// ── Mock Provider (tests only) ──

export class MockOpenID3Provider implements OpenID3Provider {
  public shouldFail = false;
  public failReason = "Mock verification failed";
  public fixedHandle = "test-user";
  public fixedAccountId = "mock-account-123";

  private sessionCounter = 0;

  isConfigured(): boolean {
    return true;
  }

  async createOAuthSession(params: OAuthParams): Promise<OAuthSession> {
    this.sessionCounter++;
    return {
      sessionId: `mock-session-${this.sessionCounter}`,
      authUrl: `https://mock-oauth.example.com/auth?subject=${params.subject}&provider=${params.providerId}`,
      expiresAt: Date.now() + 3600_000,
    };
  }

  async exchangeCode(_code: string, _sessionId: string): Promise<UserInfoResult> {
    if (this.shouldFail) {
      throw new Error(this.failReason);
    }

    return {
      provider: "mock-oauth",
      accountHandle: this.fixedHandle,
      accountId: this.fixedAccountId,
      verified: true,
      profileData: { mock: true },
    };
  }
}

// ── Factory ──

export function getOpenID3Provider(): OpenID3Provider {
  const config = envConfig();
  const redirectBase = process.env.OPENID3_REDIRECT_BASE || "http://localhost:5173";
  const provider = new OpenID3OAuthProvider(config, redirectBase);
  if (provider.isConfigured()) return provider;
  return new MockOpenID3Provider();
}

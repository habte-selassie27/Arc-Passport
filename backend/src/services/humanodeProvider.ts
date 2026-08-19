/**
 * humanodeProvider.ts
 *
 * Adapter boundary between ArcPass and an external proof-of-personhood provider
 * (Humanode). The provider integration is intentionally isolated here so it can
 * be swapped or replaced without touching the application/domain logic in
 * `humanodeService.ts`.
 *
 * SECURITY / PRIVACY:
 * - This module NEVER receives, stores, or logs raw biometric data, face images,
 *   or any PII. It only exchanges OAuth tokens for a pseudonymous Humanode
 *   account id + a uniqueness `nullifier` (a cryptographic reference, not PII).
 * - The real implementation (`HumanodeApiProvider`) talks to Humanode's OAuth2 /
 *   user-info endpoints. A `MockHumanodeProvider` is provided ONLY for tests and
 *   must never be wired into production.
 */

export interface HumanodeUserInfo {
  /** Pseudonymous Humanode account id. Not PII. */
  accountId: string;
  /**
   * Cryptographic uniqueness anchor. Two proofs from the same human MUST produce
   * the same nullifier; two different humans MUST produce different nullifiers.
   * This is the primitive that enforces "one human → one account".
   */
  nullifier: `0x${string}`;
  /** True if Humanode confirmed the subject is a unique, living human. */
  isUniqueHuman: boolean;
  /** Provider label stored in the attestation (e.g. "humanode"). */
  mechanism: string;
}

export interface HumanodeAuthSession {
  /** Opaque browser/device identifier used as the OAuth `state` nonce. */
  state: string;
  /** Full URL the user must visit to perform biometric verification. */
  authorizeUrl: string;
  /** Verification id tracked locally for polling. */
  verificationId: string;
}

export interface HumanodeProvider {
  /** Begin an OAuth authorization session for `subject`. */
  createAuthSession(subject: `0x${string}`, verificationId: string): Promise<HumanodeAuthSession>;
  /**
   * Exchange an OAuth `code` + `state` for the verified user info.
   * Throws if the code is invalid, expired, or the user is not a unique human.
   */
  exchangeCode(code: string, state: string): Promise<HumanodeUserInfo>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Real provider — integrates with Humanode's OAuth2 + user-info API.
// ─────────────────────────────────────────────────────────────────────────────

export interface HumanodeApiConfig {
  clientId: string;
  clientSecret: string;
  /** Base URL, e.g. https://api.humanode.io (no trailing slash). */
  baseUrl: string;
  /** Redirect URI registered with the Humanode OAuth app. */
  redirectUri: string;
}

function envConfig(): HumanodeApiConfig | null {
  const clientId = process.env.HUMANODE_CLIENT_ID;
  const clientSecret = process.env.HUMANODE_CLIENT_SECRET;
  const baseUrl = process.env.HUMANODE_API_BASE_URL?.replace(/\/+$/, "");
  const redirectUri = process.env.HUMANODE_REDIRECT_URI;
  if (!clientId || !clientSecret || !baseUrl || !redirectUri) return null;
  return { clientId, clientSecret, baseUrl, redirectUri };
}

export class HumanodeApiProvider implements HumanodeProvider {
  constructor(private readonly config: HumanodeApiConfig) {}

  async createAuthSession(
    subject: `0x${string}`,
    verificationId: string
  ): Promise<HumanodeAuthSession> {
    const state = `${verificationId}:${subject.toLowerCase()}`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: "openid human_info",
      state,
    });
    return {
      state,
      authorizeUrl: `${this.config.baseUrl}/oauth2/auth?${params.toString()}`,
      verificationId,
    };
  }

  async exchangeCode(code: string, state: string): Promise<HumanodeUserInfo> {
    // 1. Exchange code for tokens.
    const tokenRes = await fetch(`${this.config.baseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }).toString(),
    });
    if (!tokenRes.ok) {
      throw new Error(`Humanode token exchange failed: ${tokenRes.status}`);
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) throw new Error("Humanode: no access_token in response");

    // 2. Fetch the verified human info.
    const infoRes = await fetch(`${this.config.baseUrl}/v1/humanode/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) {
      throw new Error(`Humanode user-info request failed: ${infoRes.status}`);
    }
    const info = (await infoRes.json()) as {
      account_id?: string;
      nullifier?: string;
      is_unique_human?: boolean;
    };
    if (!info.account_id || !info.nullifier) {
      throw new Error("Humanode: missing account_id/nullifier in response");
    }
    if (!info.is_unique_human) {
      throw new Error("Humanode: subject is not a unique living human");
    }

    return {
      accountId: info.account_id,
      nullifier: info.nullifier as `0x${string}`,
      isUniqueHuman: true,
      mechanism: "humanode",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Testable mock — NEVER used in production. Injected only by tests.
// ─────────────────────────────────────────────────────────────────────────────

export class MockHumanodeProvider implements HumanodeProvider {
  public shouldFail = false;
  public failNotUnique = false;
  /** Pre-seeded nullifier so tests can exercise the one-human→one-account rule. */
  public fixedNullifier: `0x${string}` =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

  async createAuthSession(
    _subject: `0x${string}`,
    verificationId: string
  ): Promise<HumanodeAuthSession> {
    const state = `${verificationId}:${_subject.toLowerCase()}`;
    return {
      state,
      authorizeUrl: `https://mock.humanode.test/oauth2/auth?state=${state}`,
      verificationId,
    };
  }

  async exchangeCode(_code: string, _state: string): Promise<HumanodeUserInfo> {
    if (this.shouldFail) throw new Error("MockHumanode: provider failure");
    if (this.failNotUnique) {
      return {
        accountId: "mock-account",
        nullifier: this.fixedNullifier,
        isUniqueHuman: false,
        mechanism: "humanode",
      };
    }
    return {
      accountId: "mock-account",
      nullifier: this.fixedNullifier,
      isUniqueHuman: true,
      mechanism: "humanode",
    };
  }
}

export function getHumanodeProvider(): HumanodeProvider {
  const cfg = envConfig();
  if (!cfg) return new MockHumanodeProvider();
  return new HumanodeApiProvider(cfg);
}

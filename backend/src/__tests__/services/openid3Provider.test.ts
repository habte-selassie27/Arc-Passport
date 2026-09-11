import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DAuthProvider, twitterRedirectUri } from "../../services/openid3Provider.js";

const SUBJECT = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const LINK = "link-1";

function redirectOf(authUrl: string): string {
  return new URL(authUrl).searchParams.get("redirect_uri") ?? "";
}

describe("openid3Provider redirect URIs", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.OPENID3_GITHUB_CLIENT_ID = "gh-id";
    process.env.OPENID3_TWITTER_CLIENT_ID = "tw-id";
    process.env.OPENID3_DISCORD_CLIENT_ID = "dc-id";
    process.env.BACKEND_URL = "https://api.example.com";
    delete process.env.OPENID3_TWITTER_REDIRECT_BASE;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("uses one identical Twitter callback URI for authorize and token exchange", async () => {
    // X rejects mismatched redirect_uris at authorize AND exchange time, so
    // both flows must share twitterRedirectUri() exactly.
    const provider = new DAuthProvider("https://front.example.com");
    const session = await provider.createOAuthSession({
      subject: SUBJECT,
      providerId: "twitter",
      linkId: LINK,
    });
    expect(redirectOf(session.authUrl)).toBe(twitterRedirectUri());
    expect(redirectOf(session.authUrl)).toBe("https://api.example.com/openid3/twitter/callback");
  });

  it("prefers OPENID3_TWITTER_REDIRECT_BASE for the Twitter callback", async () => {
    process.env.OPENID3_TWITTER_REDIRECT_BASE = "https://tw-callback.example.com";
    const provider = new DAuthProvider("https://front.example.com");
    const session = await provider.createOAuthSession({
      subject: SUBJECT,
      providerId: "twitter",
      linkId: LINK,
    });
    expect(redirectOf(session.authUrl)).toBe("https://tw-callback.example.com/openid3/twitter/callback");
  });

  it("sends other providers to the frontend callback page", async () => {
    const provider = new DAuthProvider("https://front.example.com");
    for (const providerId of ["github", "discord"] as const) {
      const session = await provider.createOAuthSession({ subject: SUBJECT, providerId, linkId: LINK });
      expect(redirectOf(session.authUrl)).toBe("https://front.example.com/openid3/callback");
    }
  });
});

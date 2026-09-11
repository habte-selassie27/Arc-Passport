import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";

// Mock Circle SDK write + on-chain reads before importing the service.
const executeContractCall = vi.fn(async () => "0xmocktxhash");
vi.mock("../../services/circleService.js", () => ({
  executeContractCall: (...args: any[]) => (executeContractCall as any)(...args),
}));

const readContract = vi.fn<[cfg: any], Promise<any>>();
vi.mock("../../services/arcService.js", () => ({
  publicClient: { readContract: (cfg: any) => readContract(cfg) },
}));

import {
  startLinking,
  handleOAuthCallback,
} from "../../services/openid3Service.js";
import { MockOpenID3Provider } from "../../services/openid3Provider.js";

const STORE = join(process.cwd(), ".openid3-links.jsonl");
const SUBJECT_A = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const ISSUER = "0x3333333333333333333333333333333333333333" as `0x${string}`;
const CLAIM = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

const provider = new MockOpenID3Provider();

function setupMocks(activeClaim: string) {
  readContract.mockImplementation(async (cfg: any) => {
    switch (cfg.functionName) {
      case "getIssuers": return [ISSUER];
      case "getActiveClaim": return activeClaim;
      case "isValid": return activeClaim !== ZERO;
      case "getClaim": return ["0x", SUBJECT_A, "0x", ISSUER, "0x", 1000n, 2000n, false, "0x", 0n];
      default: return "0x0";
    }
  });
  // GitHub token exchange → user fetch.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any) => ({
      ok: true,
      json: async () =>
        String(url).includes("access_token")
          ? { access_token: "mock-token" }
          : { login: "octocat", id: 123 },
    }))
  );
}

beforeEach(() => {
  if (existsSync(STORE)) unlinkSync(STORE);
  executeContractCall.mockClear();
  setupMocks(CLAIM);
  process.env.CIRCLE_OPENID3_ISSUER_WALLET_ID = "wallet_openid3";
  process.env.ATTESTATION_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000001";
});

afterEach(() => {
  if (existsSync(STORE)) unlinkSync(STORE);
  vi.unstubAllGlobals();
  delete process.env.CIRCLE_OPENID3_ISSUER_WALLET_ID;
  delete process.env.ATTESTATION_REGISTRY_ADDRESS;
});

describe("openid3Service", () => {
  it("skips the on-chain attest when a valid claim already exists", async () => {
    // Regression: all OpenID3 providers share one on-chain schema, so
    // re-linking reverted with ArcPass__ActiveClaimExists — surfaced as
    // "Circle: transaction failed". A still-valid claim must complete the
    // link with no new Circle tx.
    const { linkId } = await startLinking(SUBJECT_A, "github", provider);
    const record = await handleOAuthCallback(linkId, SUBJECT_A, "authcode", provider);
    expect(record.state).toBe("complete");
    expect(record.claimId).toBe(CLAIM);
    expect(record.accountHandle).toBe("octocat");
    expect(executeContractCall).not.toHaveBeenCalled();
  });

  it("attests when no prior claim exists", async () => {
    setupMocks(ZERO);
    const { linkId } = await startLinking(SUBJECT_A, "github", provider);
    const record = await handleOAuthCallback(linkId, SUBJECT_A, "authcode", provider);
    expect(record.state).toBe("complete");
    expect(record.txHash).toBe("0xmocktxhash");
    expect(executeContractCall).toHaveBeenCalledTimes(1);
  });
});

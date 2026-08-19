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
  publicClient: {
    readContract: (cfg: any) => readContract(cfg),
  },
}));

import {
  startVerification,
  handleCallback,
  getVerification,
  getVerificationBySubject,
  getVerificationByNullifier,
  MockHumanodeProvider,
} from "../../services/humanodeService.js";

const STORE = join(process.cwd(), ".humanity-verifications.jsonl");
const SUBJECT_A = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const SUBJECT_B = "0x2222222222222222222222222222222222222222" as `0x${string}`;
const ISSUER = "0x3333333333333333333333333333333333333333" as `0x${string}`;

function setupMocks() {
  // getIssuers -> [ISSUER]; getActiveClaim -> a claim id; isValid -> true; getClaim -> active.
  readContract.mockImplementation(async (cfg: any) => {
    switch (cfg.functionName) {
      case "getIssuers":
        return [ISSUER];
      case "getActiveClaim":
        return "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      case "isValid":
        return true;
      case "getClaim":
        return [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          SUBJECT_A,
          "0x",
          ISSUER,
          "0x",
          0n,
          Math.floor(Date.now() / 1000) + 100000,
          false,
          "0x",
          0n,
        ];
      default:
        return "0x0";
    }
  });
}

beforeEach(() => {
  if (existsSync(STORE)) unlinkSync(STORE);
  executeContractCall.mockClear();
  setupMocks();
  process.env.CIRCLE_HUMANITY_ISSUER_WALLET_ID = "wallet_humanity";
  process.env.ATTESTATION_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000001";
});

afterEach(() => {
  if (existsSync(STORE)) unlinkSync(STORE);
  delete process.env.CIRCLE_HUMANITY_ISSUER_WALLET_ID;
  delete process.env.ATTESTATION_REGISTRY_ADDRESS;
});

describe("humanodeService", () => {
  it("completes a full verification → issues on-chain attestation", async () => {
    const provider = new MockHumanodeProvider();
    const start = await startVerification(SUBJECT_A, provider);
    expect(start.verificationId).toBeTruthy();
    expect(start.authorizeUrl).toContain("mock.humanode.test");

    const rec = await handleCallback(start.verificationId, SUBJECT_A, "code123", start.state, provider);
    expect(rec.state).toBe("complete");
    expect(rec.claimId).toBeTruthy();
    expect(rec.txHash).toBe("0xmocktxhash");
    expect(executeContractCall).toHaveBeenCalledOnce();
  });

  it("is idempotent — re-verifying an already-verified wallet returns the same session", async () => {
    const provider = new MockHumanodeProvider();
    const first = await startVerification(SUBJECT_A, provider);
    await handleCallback(first.verificationId, SUBJECT_A, "code", first.state, provider);

    const again = await startVerification(SUBJECT_A, provider);
    expect(again.verificationId).toBe(first.verificationId);
  });

  it("enforces one-human→one-account: same nullifier bound to a different wallet is rejected", async () => {
    const provider = new MockHumanodeProvider();
    const a = await startVerification(SUBJECT_A, provider);
    await handleCallback(a.verificationId, SUBJECT_A, "code", a.state, provider);

    const providerB = new MockHumanodeProvider(); // same fixed nullifier
    const b = await startVerification(SUBJECT_B, providerB);
    await expect(
      handleCallback(b.verificationId, SUBJECT_B, "code", b.state, providerB)
    ).rejects.toThrow(/already linked/i);
  });

  it("rejects when Humanode reports the subject is not a unique human", async () => {
    const provider = new MockHumanodeProvider();
    provider.failNotUnique = true;
    const s = await startVerification(SUBJECT_A, provider);
    await expect(
      handleCallback(s.verificationId, SUBJECT_A, "code", s.state, provider)
    ).rejects.toThrow(/unique living human/i);
    const rec = getVerification(s.verificationId)!;
    expect(rec.state).toBe("failed");
  });

  it("marks verification failed when the provider errors", async () => {
    const provider = new MockHumanodeProvider();
    provider.shouldFail = true;
    const s = await startVerification(SUBJECT_A, provider);
    await expect(
      handleCallback(s.verificationId, SUBJECT_A, "code", s.state, provider)
    ).rejects.toThrow(/provider verification failed/i);
    expect(getVerification(s.verificationId)!.state).toBe("failed");
  });

  it("rejects a callback whose verification does not belong to the caller", async () => {
    const provider = new MockHumanodeProvider();
    const s = await startVerification(SUBJECT_A, provider);
    await expect(
      handleCallback(s.verificationId, SUBJECT_B, "code", s.state, provider)
    ).rejects.toThrow(/does not belong/i);
  });

  it("persists the nullifier binding for one-human→one-account checks", async () => {
    const provider = new MockHumanodeProvider();
    const s = await startVerification(SUBJECT_A, provider);
    await handleCallback(s.verificationId, SUBJECT_A, "code", s.state, provider);
    expect(getVerificationByNullifier(provider.fixedNullifier)).toBeTruthy();
    expect(getVerificationBySubject(SUBJECT_A)?.state).toBe("complete");
  });
});

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
  startVerification,
  handleCallback,
  getVerification,
  getVerificationBySubject,
  getVerificationByNullifier,
  MockPrimusProvider,
} from "../../services/primusService.js";

const STORE = join(process.cwd(), ".web2-proof-verifications.jsonl");
const SUBJECT_A = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const SUBJECT_B = "0x2222222222222222222222222222222222222222" as `0x${string}`;
const ISSUER = "0x3333333333333333333333333333333333333333" as `0x${string}`;

function setupMocks() {
  readContract.mockImplementation(async (cfg: any) => {
    switch (cfg.functionName) {
      case "getIssuers": return [ISSUER];
      case "getActiveClaim": return "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      case "isValid": return true;
      case "getClaim": return [
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
      default: return "0x0";
    }
  });
}

beforeEach(() => {
  if (existsSync(STORE)) unlinkSync(STORE);
  executeContractCall.mockClear();
  setupMocks();
  process.env.CIRCLE_WEB2_PROOF_ISSUER_WALLET_ID = "wallet_web2";
  process.env.ATTESTATION_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000001";
});

afterEach(() => {
  if (existsSync(STORE)) unlinkSync(STORE);
  delete process.env.CIRCLE_WEB2_PROOF_ISSUER_WALLET_ID;
  delete process.env.ATTESTATION_REGISTRY_ADDRESS;
});

describe("primusService", () => {
  it("completes a full verification -> issues on-chain attestation", async () => {
    const provider = new MockPrimusProvider();
    const start = await startVerification(SUBJECT_A, "github-account", provider);
    expect(start.verificationId).toBeTruthy();
    expect(start.authUrl).toContain("mock-primus");

    const rec = await handleCallback(start.verificationId, SUBJECT_A, "task-mock-1", provider);
    expect(rec.state).toBe("complete");
    expect(rec.claimId).toBeTruthy();
    expect(rec.txHash).toBe("0xmocktxhash");
    expect(rec.templateId).toBe("github-account");
    expect(executeContractCall).toHaveBeenCalledOnce();
  });

  it("is idempotent — re-verifying an already-complete wallet returns the same session", async () => {
    const provider = new MockPrimusProvider();
    const first = await startVerification(SUBJECT_A, "github-account", provider);
    await handleCallback(first.verificationId, SUBJECT_A, "task-mock-1", provider);

    const again = await startVerification(SUBJECT_A, "github-account", provider);
    expect(again.verificationId).toBe(first.verificationId);
  });

  it("enforces one-proof-per-provider across wallets", async () => {
    const provider = new MockPrimusProvider();
    const startA = await startVerification(SUBJECT_A, "github-account", provider);
    await handleCallback(startA.verificationId, SUBJECT_A, "task-mock-1", provider);

    const startB = await startVerification(SUBJECT_B, "github-account", provider);
    await expect(
      handleCallback(startB.verificationId, SUBJECT_B, "task-mock-2", provider)
    ).rejects.toThrow(/already linked|already bound/i);
  });

  it("allows same subject to re-verify (idempotent nullifier)", async () => {
    const provider = new MockPrimusProvider();
    const startA = await startVerification(SUBJECT_A, "github-account", provider);
    await handleCallback(startA.verificationId, SUBJECT_A, "task-mock-1", provider);

    // Same subject re-verifying — idempotency path, not blocked
    const again = await startVerification(SUBJECT_A, "twitter-account", provider);
    expect(again.verificationId).toBe(startA.verificationId);
  });

  it("marks failed when provider returns error", async () => {
    const provider = new MockPrimusProvider();
    provider.shouldFail = true;
    provider.failReason = "TLS handshake failed";

    const start = await startVerification(SUBJECT_A, "github-account", provider);
    await expect(
      handleCallback(start.verificationId, SUBJECT_A, "task-mock-1", provider)
    ).rejects.toThrow(/TLS handshake failed/i);

    const rec = getVerification(start.verificationId);
    expect(rec?.state).toBe("failed");
  });

  it("rejects callback with wrong task ID", async () => {
    const provider = new MockPrimusProvider();
    const start = await startVerification(SUBJECT_A, "github-account", provider);
    await expect(
      handleCallback(start.verificationId, SUBJECT_A, "wrong-task-id", provider)
    ).rejects.toThrow(/Task ID mismatch/i);
  });

  it("rejects callback from wrong wallet", async () => {
    const provider = new MockPrimusProvider();
    const start = await startVerification(SUBJECT_A, "github-account", provider);
    await expect(
      handleCallback(start.verificationId, SUBJECT_B, "task-mock-1", provider)
    ).rejects.toThrow(/does not belong/i);
  });
});

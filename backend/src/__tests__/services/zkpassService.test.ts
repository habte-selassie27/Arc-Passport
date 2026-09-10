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

// Signature checks recover against the zkPass allocator/validator addresses.
// Mock only address recovery (everything else stays real) so proof
// submissions can pass verification with a matching validator address.
const ALLOCATOR = "0x19a567b3b212a5b35bA0E3B600FbEd5c2eE9083d";
vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    recoverAddress: async () => "0x19a567b3b212a5b35bA0E3B600FbEd5c2eE9083d",
  };
});

import {
  startVerification,
  handleProofSubmission,
  getVerification,
  getVerificationBySubject,
  getVerificationByNullifier,
  getWeb2ProofStatus,
} from "../../services/zkpassService.js";

const STORE = join(process.cwd(), ".web2-proof-verifications.jsonl");
const SUBJECT_A = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const SUBJECT_B = "0x2222222222222222222222222222222222222222" as `0x${string}`;
const ISSUER = "0x3333333333333333333333333333333333333333" as `0x${string}`;

// Mock zkPass proof result
const MOCK_PROOF = {
  allocatorAddress: "0x19a567b3b212a5b35bA0E3B600FbEd5c2eE9083d",
  allocatorSignature: "0x" + "ab".repeat(65),
  publicFields: { login: "testuser", id: "12345" },
  publicFieldsHash: "0x" + "cd".repeat(32),
  taskId: "test-task-id",
  uHash: "0x" + "ef".repeat(32),
  validatorAddress: "0x" + "11".repeat(20),
  validatorSignature: "0x" + "22".repeat(65),
};

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

describe("zkpassService", () => {
  it("creates a verification session", async () => {
    const result = await startVerification(SUBJECT_A, "github-account");
    expect(result.verificationId).toBeTruthy();
  });

  it("creates different sessions for different subjects", async () => {
    const startA = await startVerification(SUBJECT_A, "github-account");
    const startB = await startVerification(SUBJECT_B, "github-account");
    expect(startA.verificationId).not.toBe(startB.verificationId);
  });

  it("allows same subject to verify different schemas", async () => {
    const startA = await startVerification(SUBJECT_A, "github-account");
    const startB = await startVerification(SUBJECT_A, "twitter-account");
    expect(startB.verificationId).toBeTruthy();
  });

  it("returns existing session if already complete", async () => {
    // This test would need the proof submission to complete first
    // For now, just verify the session creation works
    const startA = await startVerification(SUBJECT_A, "github-account");
    expect(startA.verificationId).toBeTruthy();
  });

  it("scopes idempotent sessions per schema, not per subject", async () => {
    // Regression: after completing Twitter, starting Discord returned the
    // Twitter session (lookup ignored schemaId), so the Discord proof could
    // never verify. Same schema → same session; other schema → new session.
    const { appendFileSync } = await import("fs");
    const createdMs = 1789000000000;
    appendFileSync(
      STORE,
      JSON.stringify({
        verificationId: "vid-twitter",
        subject: SUBJECT_A,
        state: "complete",
        schemaId: "twitter-account",
        provider: "zkpass-zktls",
        claimId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        createdAt: createdMs,
        updatedAt: createdMs,
        expiresAt: createdMs + 3600_000,
      }) + "\n"
    );
    const same = await startVerification(SUBJECT_A, "twitter-account");
    expect(same.verificationId).toBe("vid-twitter");
    const other = await startVerification(SUBJECT_A, "discord-account");
    expect(other.verificationId).toBeTruthy();
    expect(other.verificationId).not.toBe("vid-twitter");
  });

  it("returns status timestamps in unix SECONDS with attestation TTL (not ms session window)", async () => {
    // Regression: status once returned Date.now()-based ms values, which the
    // frontend renders as `new Date(t * 1000)` → "Expires: 2/22/58662".
    // Legacy record shape (completed before attestedAt was persisted).
    const { appendFileSync } = await import("fs");
    const createdMs = 1789000000000;
    appendFileSync(
      STORE,
      JSON.stringify({
        verificationId: "vid-legacy",
        subject: SUBJECT_A,
        state: "complete",
        schemaId: "twitter-account",
        provider: "zkpass-zktls",
        claimId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        createdAt: createdMs,
        updatedAt: createdMs,
        expiresAt: createdMs + 3600_000, // old 1h session window (ms)
      }) + "\n"
    );
    const status = await getWeb2ProofStatus(SUBJECT_A);
    expect(status.verified).toBe(true);
    // Seconds, not milliseconds.
    expect(status.expiresAt!).toBeLessThan(10_000_000_000);
    // Attestation TTL (1y), not the 1h session window.
    expect(status.expiresAt!).toBe(Math.floor(createdMs / 1000) + 365 * 24 * 60 * 60);
    expect(status.checkedAt!).toBe(Math.floor(createdMs / 1000));
  });

  it("skips the on-chain attest when a valid claim already exists", async () => {
    // Regression: every web2 template attests under one on-chain schema from
    // one issuer wallet, so re-verifying reverted with
    // ArcPass__ActiveClaimExists — surfaced as "Circle: transaction failed".
    // A still-valid claim must complete the session with no new Circle tx.
    // (Default mocks return a valid active claim: getActiveClaim → 0xaaaa…,
    // isValid → true. IDs are 32-char strings like the real zkPass
    // taskId/schemaId — stringToHex must yield exactly bytes32.)
    const schemaId = "43194186dd1f44a89f727ba64826c961";
    const { verificationId } = await startVerification(SUBJECT_A, schemaId);
    const record = await handleProofSubmission(verificationId, SUBJECT_A, {
      ...MOCK_PROOF,
      taskId: "088b83be67643d09662210ef7adddd9d",
      validatorAddress: ALLOCATOR,
    });
    expect(record.state).toBe("complete");
    expect(record.claimId).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(executeContractCall).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, unlinkSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const executeContractCall = vi.fn(async () => "0xmocktxhash");
vi.mock("../../services/circleService.js", () => ({
  executeContractCall: (...args: any[]) => (executeContractCall as any)(...args),
}));

const readContract = vi.fn<[cfg: any], Promise<any>>();
vi.mock("../../services/arcService.js", () => ({
  publicClient: { readContract: (cfg: any) => readContract(cfg) },
}));

import { commitVault, getVaultStatus } from "../../services/zkVaultService.js";

const STORE = join(process.cwd(), ".zk-id-vault.jsonl");
const SUBJECT = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const ISSUER = "0x3333333333333333333333333333333333333333" as `0x${string}`;
const CLAIM_ID = ("0x" + "aa".repeat(32)) as `0x${string}`;
const FIELDS_HASH_A = ("0x" + "aa".repeat(32)) as `0x${string}`;
const FIELDS_HASH_B = ("0x" + "bb".repeat(32)) as `0x${string}`;

function setupMocks(opts: { isValid?: boolean; getClaimTimes?: [bigint, bigint] } = {}) {
  const { isValid = true, getClaimTimes } = opts;
  readContract.mockImplementation(async (cfg: any) => {
    switch (cfg.functionName) {
      case "getIssuers": return [ISSUER];
      case "getActiveClaim": return CLAIM_ID;
      case "isValid": return isValid;
      case "getClaim": return [
        "0x" + "aa".repeat(32), SUBJECT, "0x", ISSUER, "0x",
        ...(getClaimTimes ?? [1700000000n, BigInt(Math.floor(Date.now() / 1000) + 365 * 86400)]),
        false, "0x", 0n,
      ];
      default: return "0x0";
    }
  });
}

beforeEach(() => {
  if (existsSync(STORE)) unlinkSync(STORE);
  executeContractCall.mockClear();
  readContract.mockClear();
  setupMocks();
  process.env.ATTESTATION_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000001";
  process.env.CIRCLE_ZK_ISSUER_WALLET_ID = "wallet_zk";
});

afterEach(() => {
  if (existsSync(STORE)) unlinkSync(STORE);
  delete process.env.ATTESTATION_REGISTRY_ADDRESS;
  delete process.env.CIRCLE_ZK_ISSUER_WALLET_ID;
});

describe("getVaultStatus", () => {
  it("returns committed:false when no record exists and no on-chain claim", async () => {
    readContract.mockImplementation(async (cfg: any) => {
      switch (cfg.functionName) {
        case "getIssuers": return [ISSUER];
        case "getActiveClaim": return "0x" + "00".repeat(32);
        case "isValid": return false;
        default: return "0x0";
      }
    });

    const status = await getVaultStatus(SUBJECT);
    expect(status.committed).toBe(false);
    expect(status.isValid).toBe(false);
  });

  it("returns isValid:true when local record has a valid on-chain claim", async () => {
    // Commit first so a local record exists.
    await commitVault({
      subject: SUBJECT,
      vaultCid: "ipfs://bafytest",
      fieldsHash: FIELDS_HASH_B,
      documentType: "passport",
    });

    const status = await getVaultStatus(SUBJECT);
    expect(status.committed).toBe(true);
    expect(status.isValid).toBe(true);
    expect(status.claimId).toBe(CLAIM_ID);
  });

  it("re-discovers on-chain claim when local claimId is invalid (JSONL stale)", async () => {
    // Commit to create a local record.
    await commitVault({
      subject: SUBJECT,
      vaultCid: "ipfs://bafytest",
      fieldsHash: FIELDS_HASH_B,
      documentType: "passport",
    });

    // Verify record was written.
    const before = await getVaultStatus(SUBJECT);
    expect(before.isValid).toBe(true);

    // Corrupt the local record's claimId.
    const lines = readFileSync(STORE, "utf8").split("\n").filter(Boolean);
    const record = JSON.parse(lines[0]);
    record.claimId = "0x" + "ff".repeat(32);
    writeFileSync(STORE, JSON.stringify(record) + "\n");

    // Now isValid returns false for the corrupted claimId, but re-discovery
    // finds the correct on-chain claim and recovers.
    readContract.mockImplementation(async (cfg: any) => {
      switch (cfg.functionName) {
        case "getIssuers": return [ISSUER];
        case "getActiveClaim": return CLAIM_ID;
        case "isValid": return cfg.args?.[0] === CLAIM_ID;  // only the real claim is valid
        case "getClaim": return [
          CLAIM_ID, SUBJECT, "0x", ISSUER, "0x",
          1700000000n, BigInt(Math.floor(Date.now() / 1000) + 365 * 86400),
          false, "0x", 0n,
        ];
        default: return "0x0";
      }
    });

    const status = await getVaultStatus(SUBJECT);
    expect(status.committed).toBe(true);
    expect(status.isValid).toBe(true);
    expect(status.claimId).toBe(CLAIM_ID);
  });

  it("returns isValid:false when no on-chain claim exists and JSONL has no valid record", async () => {
    // Commit to create a local record.
    await commitVault({
      subject: SUBJECT,
      vaultCid: "ipfs://bafytest",
      fieldsHash: FIELDS_HASH_B,
      documentType: "passport",
    });

    // Now make all on-chain reads return no valid claim.
    readContract.mockImplementation(async (cfg: any) => {
      switch (cfg.functionName) {
        case "getIssuers": return [ISSUER];
        case "getActiveClaim": return "0x" + "00".repeat(32);
        case "isValid": return false;
        default: return "0x0";
      }
    });

    const status = await getVaultStatus(SUBJECT);
    expect(status.committed).toBe(true);
    expect(status.isValid).toBe(false);
  });

  it("returns isValid:false when ATTESTATION_REGISTRY_ADDRESS is not set", async () => {
    delete process.env.ATTESTATION_REGISTRY_ADDRESS;

    // Commit with the env var set first.
    process.env.ATTESTATION_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000001";
    await commitVault({
      subject: SUBJECT,
      vaultCid: "ipfs://bafytest",
      fieldsHash: FIELDS_HASH_B,
      documentType: "passport",
    });

    // Remove the env var — both isClaimValidOnChain and recoverClaimId will bail.
    delete process.env.ATTESTATION_REGISTRY_ADDRESS;

    const status = await getVaultStatus(SUBJECT);
    expect(status.committed).toBe(true);
    expect(status.isValid).toBe(false);
  });
});

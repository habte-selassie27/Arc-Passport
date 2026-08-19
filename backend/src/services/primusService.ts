import { randomUUID } from "crypto";
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import { keccak256, encodePacked } from "viem";
import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { executeContractCall } from "./circleService.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import { SOCIAL_SCHEMAS } from "../constants/schemas.js";
import { PrimusProvider, MockPrimusProvider } from "./primusProvider.js";

// ── Schema ──

const WEB2_DATA_PROOF_ID = SOCIAL_SCHEMAS.WEB2_DATA_PROOF.id!;
const VERIFICATION_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

// ── Domain Types ──

export type Web2ProofState = "initialized" | "pending" | "verified" | "attesting" | "complete" | "failed" | "expired";

export interface Web2ProofVerification {
  verificationId: string;
  subject: string;
  state: Web2ProofState;
  templateId: string;
  taskId?: string;
  nullifier?: string; // provider-specific uniqueness key
  provider?: string;
  dataHash?: string;
  claimId?: string;
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

// ── Persistence (advisory JSONL) ──

const STORE_PATH = join(process.cwd(), ".web2-proof-verifications.jsonl");

function readAll(): Web2ProofVerification[] {
  try {
    if (!existsSync(STORE_PATH)) return [];
    return readFileSync(STORE_PATH, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function writeAll(records: Web2ProofVerification[]): void {
  try {
    writeFileSync(STORE_PATH, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  } catch { /* advisory */ }
}

function upsert(record: Web2ProofVerification): void {
  const all = readAll();
  const idx = all.findIndex((r) => r.verificationId === record.verificationId);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  writeAll(all);
}

// ── On-chain reads ──

async function isClaimValidOnChain(claimId: string): Promise<boolean> {
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) return false;
  try {
    return (await publicClient.readContract({
      address: process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "isValid",
      args: [claimId as `0x${string}`],
    })) as boolean;
  } catch {
    return false;
  }
}

async function recoverClaimId(
  subject: `0x${string}`,
  schemaId: `0x${string}`
): Promise<string | undefined> {
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) return undefined;
  try {
    const issuers = (await publicClient.readContract({
      address: process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "getIssuers",
    })) as `0x${string}`[];
    for (const issuer of issuers) {
      const claimId = (await publicClient.readContract({
        address: process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: "getActiveClaim",
        args: [subject, schemaId, issuer],
      })) as `0x${string}`;
      if (claimId && claimId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        return claimId;
      }
    }
  } catch {
    /* best-effort */
  }
  return undefined;
}

// ── Query helpers ──

export function getVerification(verificationId: string): Web2ProofVerification | undefined {
  return readAll().find((r) => r.verificationId === verificationId);
}

export function getVerificationBySubject(subject: string): Web2ProofVerification | undefined {
  const lower = subject.toLowerCase();
  return readAll()
    .filter((r) => r.subject.toLowerCase() === lower)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export function getVerificationByNullifier(nullifier: string): Web2ProofVerification | undefined {
  const lower = nullifier.toLowerCase();
  return readAll().find(
    (r) => r.nullifier && r.nullifier.toLowerCase() === lower && r.state === "complete"
  );
}

// ── Core Service ──

export async function startVerification(
  subject: `0x${string}`,
  templateId: string,
  provider: PrimusProvider
): Promise<{ verificationId: string; authUrl: string }> {
  // Idempotency: if already complete + valid on-chain, return existing session
  const existing = getVerificationBySubject(subject);
  if (existing?.state === "complete" && existing.claimId) {
    const stillValid = await isClaimValidOnChain(existing.claimId);
    if (stillValid) {
      const session = await provider.createVerificationTask({ subject, templateId });
      return { verificationId: existing.verificationId, authUrl: session.authUrl };
    }
  }

  const verificationId = randomUUID();
  const session = await provider.createVerificationTask({ subject, templateId });

  const record: Web2ProofVerification = {
    verificationId,
    subject,
    state: "initialized",
    templateId,
    taskId: session.taskId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: session.expiresAt,
  };
  upsert(record);

  return { verificationId, authUrl: session.authUrl };
}

export async function handleCallback(
  verificationId: string,
  subject: `0x${string}`,
  taskId: string,
  provider: PrimusProvider
): Promise<Web2ProofVerification> {
  const record = getVerification(verificationId);
  if (!record) throw Errors.VerificationNotFound(verificationId);
  if (record.subject.toLowerCase() !== subject.toLowerCase()) {
    throw Errors.VerificationMismatch();
  }
  if (record.state === "complete") return record;
  if (record.state === "initialized" && record.taskId !== taskId) {
    record.state = "failed";
    record.error = "Task ID mismatch";
    record.updatedAt = Date.now();
    upsert(record);
    throw Errors.TaskIdMismatch();
  }

  const now = Date.now();
  if (record.expiresAt < now) {
    record.state = "expired";
    record.updatedAt = now;
    upsert(record);
    throw Errors.VerificationExpired();
  }

  // Verify via provider
  const result = await provider.verifyProof(taskId);
  if (!result.verified || result.error) {
    record.state = "failed";
    record.error = result.error ?? "Verification failed";
    record.updatedAt = now;
    upsert(record);
    throw Errors.ProviderVerifyFailed(result.error ?? "unknown");
  }

  // One-proof-per-provider: reject if nullifier already bound to different subject
  if (result.dataHash) {
    const prior = getVerificationByNullifier(result.dataHash);
    if (prior && prior.subject.toLowerCase() !== subject.toLowerCase()) {
      record.state = "failed";
      record.error = "Data hash already bound to another wallet";
      record.updatedAt = now;
      upsert(record);
      throw Errors.ProviderAlreadyBound();
    }
  }

  // Mark verified, then issue on-chain attestation
  record.state = "verified";
  record.nullifier = result.dataHash;
  record.provider = result.provider;
  record.dataHash = result.dataHash;
  record.updatedAt = now;
  upsert(record);

  const walletId = process.env.CIRCLE_WEB2_PROOF_ISSUER_WALLET_ID;
  if (!walletId) {
    throw Errors.IssuerNotConfigured("web2-proof", "CIRCLE_WEB2_PROOF_ISSUER_WALLET_ID");
  }
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) {
    throw Errors.IssuerNotConfigured("web2-proof", "ATTESTATION_REGISTRY_ADDRESS");
  }

  const checkedAt = Math.floor(Date.now() / 1000);
  const expiresAt = checkedAt + VERIFICATION_TTL_SECONDS;
  const dataCommitment = keccak256(
    encodePacked(
      ["address", "bytes32", "string", "string", "uint64"],
      [subject, result.dataHash as `0x${string}`, result.provider, result.templateId, BigInt(checkedAt)]
    )
  );

  record.state = "attesting";
  record.updatedAt = Date.now();
  upsert(record);

  let txHash: string;
  try {
    txHash = await executeContractCall(
      walletId,
      process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
      "attest(address,bytes32,bytes32,uint256)",
      [subject, WEB2_DATA_PROOF_ID, dataCommitment, expiresAt.toString()]
    );
  } catch (err) {
    record.state = "failed";
    record.error = (err as Error).message;
    record.updatedAt = Date.now();
    upsert(record);
    throw Errors.AttestationFailed((err as Error).message);
  }

  const claimId = await recoverClaimId(subject, WEB2_DATA_PROOF_ID);

  record.state = "complete";
  record.claimId = claimId ?? undefined;
  record.txHash = txHash;
  record.updatedAt = Date.now();
  upsert(record);

  return record;
}

export async function getWeb2ProofStatus(
  address: string
): Promise<{ verified: boolean; provider?: string; checkedAt?: number; expiresAt?: number; isHolder: boolean }> {
  const record = getVerificationBySubject(address);
  if (!record || record.state !== "complete" || !record.claimId) {
    return { verified: false, isHolder: false };
  }

  const valid = await isClaimValidOnChain(record.claimId);
  return {
    verified: valid,
    provider: record.provider,
    checkedAt: record.createdAt,
    expiresAt: record.expiresAt,
    isHolder: valid,
  };
}

// Re-export the mock so tests can inject it without importing the provider module.
export { MockPrimusProvider };

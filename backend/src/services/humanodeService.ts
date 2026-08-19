import { randomUUID } from "crypto";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { keccak256, encodePacked } from "viem";
import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { executeContractCall } from "./circleService.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import { SOCIAL_SCHEMAS } from "../constants/schemas.js";
import {
  HumanodeProvider,
  getHumanodeProvider,
  MockHumanodeProvider,
} from "./humanodeProvider.js";

const STORE_PATH = join(process.cwd(), ".humanity-verifications.jsonl");

/** Session lifetime before the user must complete the OAuth flow. */
const SESSION_TTL_MS = 15 * 60 * 1000;

/** On-chain humanity attestation lifetime (seconds). */
function attestationTtlSeconds(): number {
  return parseInt(process.env.HUMANITY_ATTESTATION_TTL_SECONDS || "15552000", 10); // 180 days
}

const HUMANITY_PROOF_ID = SOCIAL_SCHEMAS.HUMANITY_PROOF.id!;

export type HumanodeState =
  | "initialized"
  | "verified"
  | "attesting"
  | "complete"
  | "failed"
  | "expired";

export interface HumanityVerification {
  verificationId: string;
  subject: string; // checksummed address
  state: HumanodeState;
  humanodeAccountId?: string;
  nullifier?: string; // bytes32 hex
  mechanism?: string;
  claimId?: string; // on-chain attestation claim id
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface StartResult {
  verificationId: string;
  authorizeUrl: string;
  state: string;
  expiresAt: number;
}

export interface HumanityStatus {
  subject: string;
  verified: boolean;
  onChain: boolean;
  state: HumanodeState | null;
  claimId?: string;
  mechanism?: string;
  checkedAt?: number;
  expiresAt?: number;
}

// ── Advisory persistence (JSONL, like the claim indexer) ──

function readAll(): HumanityVerification[] {
  if (!existsSync(STORE_PATH)) return [];
  try {
    return readFileSync(STORE_PATH, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function writeAll(records: HumanityVerification[]): void {
  try {
    writeFileSync(STORE_PATH, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  } catch {
    /* advisory — never crash */
  }
}

function upsert(record: HumanityVerification): void {
  const records = readAll();
  const idx = records.findIndex((r) => r.verificationId === record.verificationId);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  writeAll(records);
}

function append(record: HumanityVerification): void {
  try {
    appendFileSync(STORE_PATH, JSON.stringify(record) + "\n");
  } catch {
    /* advisory */
  }
}

export function getVerification(verificationId: string): HumanityVerification | undefined {
  return readAll().find((r) => r.verificationId === verificationId);
}

export function getVerificationBySubject(subject: string): HumanityVerification | undefined {
  const lower = subject.toLowerCase();
  return readAll()
    .filter((r) => r.subject.toLowerCase() === lower)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export function getVerificationByNullifier(nullifier: string): HumanityVerification | undefined {
  const lower = nullifier.toLowerCase();
  return readAll().find(
    (r) => r.nullifier && r.nullifier.toLowerCase() === lower && r.state === "complete"
  );
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

async function claimExpiryOnChain(claimId: string): Promise<number | undefined> {
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) return undefined;
  try {
    const c = (await publicClient.readContract({
      address: process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "getClaim",
      args: [claimId as `0x${string}`],
    })) as any;
    return Number(c[6]); // expiresAt
  } catch {
    return undefined;
  }
}

// ── Public status (no auth) ──

export async function getHumanityStatus(address: `0x${string}`): Promise<HumanityStatus> {
  const record = getVerificationBySubject(address);
  if (!record || !record.claimId) {
    return { subject: address, verified: false, onChain: false, state: record?.state ?? null };
  }
  const onChain = await isClaimValidOnChain(record.claimId);
  const expiresAt = await claimExpiryOnChain(record.claimId);
  return {
    subject: address,
    verified: onChain,
    onChain,
    state: onChain ? "complete" : record.state,
    claimId: record.claimId,
    mechanism: record.mechanism,
    checkedAt: record.updatedAt,
    expiresAt,
  };
}

// ── Verification workflow ──

export async function startVerification(
  subject: `0x${string}`,
  provider: HumanodeProvider = getHumanodeProvider()
): Promise<StartResult> {
  // Idempotency: if the subject already holds a complete, on-chain-valid proof,
  // return the existing session instead of starting a new one.
  const existing = getVerificationBySubject(subject);
  if (existing?.state === "complete" && existing.claimId) {
    const stillValid = await isClaimValidOnChain(existing.claimId);
    if (stillValid) {
      const session = await provider.createAuthSession(subject, existing.verificationId);
      return {
        verificationId: existing.verificationId,
        authorizeUrl: session.authorizeUrl,
        state: session.state,
        expiresAt: existing.expiresAt,
      };
    }
  }

  const verificationId = randomUUID();
  const now = Date.now();
  const session = await provider.createAuthSession(subject, verificationId);

  const record: HumanityVerification = {
    verificationId,
    subject,
    state: "initialized",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  append(record);

  return {
    verificationId,
    authorizeUrl: session.authorizeUrl,
    state: session.state,
    expiresAt: record.expiresAt,
  };
}

export async function handleCallback(
  verificationId: string,
  subject: `0x${string}`,
  code: string,
  state: string,
  provider: HumanodeProvider = getHumanodeProvider()
): Promise<HumanityVerification> {
  const record = getVerification(verificationId);
  if (!record) throw Errors.VerificationNotFound(verificationId);
  if (record.subject.toLowerCase() !== subject.toLowerCase()) {
    throw Errors.VerificationMismatch();
  }
  if (record.state === "complete") return record; // already done — idempotent
  if (Date.now() > record.expiresAt) {
    record.state = "expired";
    record.updatedAt = Date.now();
    upsert(record);
    throw Errors.VerificationExpired();
  }

  // 1. Exchange the OAuth code with the provider.
  let info;
  try {
    info = await provider.exchangeCode(code, state);
  } catch (err) {
    record.state = "failed";
    record.error = (err as Error).message;
    record.updatedAt = Date.now();
    upsert(record);
    throw Errors.HumanodeVerifyFailed((err as Error).message);
  }

  if (!info.isUniqueHuman) {
    record.state = "failed";
    record.error = "Subject is not a unique living human";
    record.updatedAt = Date.now();
    upsert(record);
    throw Errors.HumanodeNotUnique();
  }

  // 2. One human → one account: reject if this nullifier is already bound.
  const prior = getVerificationByNullifier(info.nullifier);
  if (prior && prior.subject.toLowerCase() !== subject.toLowerCase()) {
    record.state = "failed";
    record.error = "Nullifier already bound to another wallet";
    record.updatedAt = Date.now();
    upsert(record);
    throw Errors.HumanodeAlreadyBound();
  }

  // 3. Mark verified, then issue the on-chain Humanity Proof attestation.
  record.state = "verified";
  record.humanodeAccountId = info.accountId;
  record.nullifier = info.nullifier;
  record.mechanism = info.mechanism;
  record.updatedAt = Date.now();
  upsert(record);

  const walletId = process.env.CIRCLE_HUMANITY_ISSUER_WALLET_ID;
  if (!walletId) {
    throw Errors.IssuerNotConfigured("humanity", "CIRCLE_HUMANITY_ISSUER_WALLET_ID");
  }
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) {
    throw Errors.ScoreNotConfigured(); // reuse "registry not configured" shape
  }

  const checkedAt = Math.floor(Date.now() / 1000);
  const expiresAt = checkedAt + attestationTtlSeconds();
  const dataCommitment = keccak256(
    encodePacked(
      ["address", "bytes32", "string", "uint64"],
      [subject, info.nullifier, info.mechanism, BigInt(checkedAt)]
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
      [subject, HUMANITY_PROOF_ID, dataCommitment, expiresAt.toString()]
    );
  } catch (err) {
    record.state = "failed";
    record.error = (err as Error).message;
    record.updatedAt = Date.now();
    upsert(record);
    throw Errors.AttestationFailed((err as Error).message);
  }

  // The claimId is deterministic from the registry's nonce; recover it via on-chain read.
  const claimId = await recoverClaimId(subject, HUMANITY_PROOF_ID);

  record.state = "complete";
  record.claimId = claimId ?? undefined;
  record.txHash = txHash;
  record.updatedAt = Date.now();
  upsert(record);

  return record;
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

// Re-export the mock so tests can inject it without importing the provider module.
export { MockHumanodeProvider };

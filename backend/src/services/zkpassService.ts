import { randomUUID } from "crypto";
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import { keccak256, encodePacked, encodeAbiParameters, stringToHex, recoverAddress, hashMessage, toBytes } from "viem";
import { publicClient } from "./arcService.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { executeContractCall } from "./circleService.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import { SOCIAL_SCHEMAS } from "../constants/schemas.js";

// ── zkPass Configuration ──

const FIXED_ALLOCATOR_ADDRESS = "0x19a567b3b212a5b35bA0E3B600FbEd5c2eE9083d";
const WEB2_DATA_PROOF_ID = SOCIAL_SCHEMAS.WEB2_DATA_PROOF.id!;
const VERIFICATION_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

// ── Domain Types ──

export type Web2ProofState = "initialized" | "pending" | "verified" | "attesting" | "complete" | "failed" | "expired";

export interface ZkPassProofResult {
  allocatorAddress: string;
  allocatorSignature: string;
  publicFields: Record<string, string>;
  publicFieldsHash: string;
  taskId: string;
  uHash: string;
  validatorAddress: string;
  validatorSignature: string;
  recipient?: string;
}

export interface Web2ProofVerification {
  verificationId: string;
  subject: string;
  state: Web2ProofState;
  schemaId: string;
  taskId?: string;
  nullifier?: string;
  provider?: string;
  dataHash?: string;
  claimId?: string;
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  // Attestation timestamps (unix SECONDS, set at completion). The API-wide
  // convention is seconds (frontends render `new Date(t * 1000)`); createdAt /
  // expiresAt above are session timestamps in MILLISECONDS — never return
  // those from status endpoints (renders as year 58k).
  attestedAt?: number;
  attestationExpiresAt?: number;
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

// ── Signature Verification ──
// Must mirror @zkpass/transgate-js-sdk checkTaskInfoForEVM /
// verifyEVMMessageSignature exactly:
//   taskHex = web3.utils.stringToHex(taskId)
//   schemaHex = web3.utils.stringToHex(schemaId)
//   encoded = abi.encode(['bytes32','bytes32','address'], ...)
//   hash = keccak256(encoded)
// Using encodePacked here produces a different hash (84 vs 96 bytes)
// and always recovers the wrong address.
//
// CRITICAL: the SDK then calls web3.eth.accounts.recover(hash, signature),
// which applies hashMessage() first — i.e. recovery is over the EIP-191
// prefixed hash keccak256("\x19Ethereum Signed Message:\n32" ‖ hash).
// viem's recoverAddress() recovers over the RAW hash, so passing paramsHash
// directly always recovers the wrong address ("Invalid allocator signature").
// We must wrap with hashMessage({ raw }) to match the SDK.

async function verifyAllocatorSignature(proof: ZkPassProofResult, schemaId: string): Promise<boolean> {
  try {
    const taskIdHex = stringToHex(proof.taskId);
    const schemaIdHex = stringToHex(schemaId);

    // abi.encode equivalent — NOT encodePacked
    const encoded = encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "address" }],
      [taskIdHex as `0x${string}`, schemaIdHex as `0x${string}`, proof.validatorAddress as `0x${string}`]
    );

    // Hash the encoded parameters, then EIP-191 prefix (matches web3 recover)
    const paramsHash = keccak256(encoded);
    const prefixedHash = hashMessage({ raw: toBytes(paramsHash) });

    // Recover the signer address
    const recovered = await recoverAddress({
      hash: prefixedHash,
      signature: proof.allocatorSignature as `0x${string}`,
    });

    return recovered.toLowerCase() === FIXED_ALLOCATOR_ADDRESS.toLowerCase();
  } catch {
    return false;
  }
}

async function verifyValidatorSignature(proof: ZkPassProofResult, schemaId: string): Promise<boolean> {
  try {
    const taskIdHex = stringToHex(proof.taskId);
    const schemaIdHex = stringToHex(schemaId);

    // abi.encode equivalent — NOT encodePacked (see above)
    const types = [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }] as const;
    const baseValues = [
      taskIdHex as `0x${string}`,
      schemaIdHex as `0x${string}`,
      proof.uHash as `0x${string}`,
      proof.publicFieldsHash as `0x${string}`,
    ];

    const encoded = proof.recipient
      ? encodeAbiParameters(
          [...types, { type: "address" }] as const,
          [...baseValues, proof.recipient as `0x${string}`] as any
        )
      : encodeAbiParameters(types, baseValues as any);

    // EIP-191 prefix — matches web3 accounts.recover in verifyEVMMessageSignature
    const paramsHash = keccak256(encoded);
    const prefixedHash = hashMessage({ raw: toBytes(paramsHash) });

    const recovered = await recoverAddress({
      hash: prefixedHash,
      signature: proof.validatorSignature as `0x${string}`,
    });

    return recovered.toLowerCase() === proof.validatorAddress.toLowerCase();
  } catch {
    return false;
  }
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

export function getVerificationBySubjectAndSchema(subject: string, schemaId: string): Web2ProofVerification | undefined {
  const lower = subject.toLowerCase();
  return readAll()
    .filter((r) => r.subject.toLowerCase() === lower && r.schemaId === schemaId)
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
  schemaId: string
): Promise<{ verificationId: string }> {
  // Idempotency is per (subject, schemaId): a completed Twitter proof must
  // not swallow a new Discord session (each template gets its own session).
  const existing = getVerificationBySubjectAndSchema(subject, schemaId);
  if (existing?.state === "complete" && existing.claimId) {
    const stillValid = await isClaimValidOnChain(existing.claimId);
    if (stillValid) {
      return { verificationId: existing.verificationId };
    }
  }

  const verificationId = randomUUID();

  const record: Web2ProofVerification = {
    verificationId,
    subject,
    state: "initialized",
    schemaId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 3600_000, // 1 hour to complete
  };
  upsert(record);

  return { verificationId };
}

export async function handleProofSubmission(
  verificationId: string,
  subject: `0x${string}`,
  proof: ZkPassProofResult
): Promise<Web2ProofVerification> {
  const record = getVerification(verificationId);
  if (!record) throw Errors.VerificationNotFound(verificationId);
  if (record.subject.toLowerCase() !== subject.toLowerCase()) {
    throw Errors.VerificationMismatch();
  }
  if (record.state === "complete") return record;

  const now = Date.now();
  if (record.expiresAt < now) {
    record.state = "expired";
    record.updatedAt = now;
    upsert(record);
    throw Errors.VerificationExpired();
  }

  // Verify allocator signature
  const allocatorValid = await verifyAllocatorSignature(proof, record.schemaId);
  if (!allocatorValid) {
    record.state = "failed";
    record.error = "Invalid allocator signature";
    record.updatedAt = now;
    upsert(record);
    throw Errors.ProviderVerifyFailed("Invalid allocator signature");
  }

  // Verify validator signature
  const validatorValid = await verifyValidatorSignature(proof, record.schemaId);
  if (!validatorValid) {
    record.state = "failed";
    record.error = "Invalid validator signature";
    record.updatedAt = now;
    upsert(record);
    throw Errors.ProviderVerifyFailed("Invalid validator signature");
  }

  // One-proof-per-provider: reject if nullifier already bound to different subject
  if (proof.uHash) {
    const prior = getVerificationByNullifier(proof.uHash);
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
  record.nullifier = proof.uHash;
  record.provider = "zkpass-zktls";
  record.dataHash = proof.publicFieldsHash;
  record.taskId = proof.taskId;
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
      [subject, proof.publicFieldsHash as `0x${string}`, "zkpass-zktls", record.schemaId, BigInt(checkedAt)]
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
  record.attestedAt = checkedAt;
  record.attestationExpiresAt = expiresAt;
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
  // Seconds + attestation TTL (not the 1-hour session window). Fallbacks cover
  // records completed before attestedAt/attestationExpiresAt were persisted.
  const checkedAtSec = record.attestedAt ?? Math.floor(record.createdAt / 1000);
  return {
    verified: valid,
    provider: record.provider,
    checkedAt: checkedAtSec,
    expiresAt: record.attestationExpiresAt ?? (checkedAtSec + VERIFICATION_TTL_SECONDS),
    isHolder: valid,
  };
}

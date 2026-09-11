/**
 * zkVaultService.ts — Encrypted ID Vault commitment service.
 *
 * What it does: records a *commitment* to an encrypted identity-document vault
 *   on-chain. The raw document data never touches this service — only the IPFS
 *   CID of the client-side-encrypted blob, a hash of the extracted fields, and
 *   a per-(wallet, document) nullifier.
 * What it does NOT do: encryption, OCR, or IPFS upload (all client-side /
 *   handled by routes/upload.ts).
 * What calls it: routes/zk.ts
 *
 * Data model:
 *   fieldsHash     = keccak256(JSON.stringify(fields))            (client-side)
 *   nullifier      = keccak256("arcpass-id-vault" + subject + fieldsHash)
 *   dataCommitment = keccak256(subject + nullifier + documentType + true + committedAt)
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { keccak256, encodePacked } from "viem";
import { publicClient } from "./arcService.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { executeContractCall } from "./circleService.js";
import { ZK_PASSPORT_SCHEMAS } from "../constants/schemas.js";
import { ArcPassError, Errors } from "../utils/errors.js";

const ID_VAULT_COMMITMENT_ID = ZK_PASSPORT_SCHEMAS.ID_VAULT_COMMITMENT.id!;
const VAULT_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

// ── Types ─────────────────────────────────────────────────────────────────

export interface VaultCommitment {
  subject: string;
  vaultCid: string;
  fieldsHash: string;
  documentType: string;
  nullifier: string;
  claimId?: string;
  txHash?: string;
  committedAt: number;
  expiresAt: number;
}

// ── Persistence (advisory JSONL, same pattern as openid3/zkpass stores) ──

const STORE_PATH = join(process.cwd(), ".zk-id-vault.jsonl");

function readAll(): VaultCommitment[] {
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

function writeAll(records: VaultCommitment[]): void {
  try {
    writeFileSync(STORE_PATH, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  } catch {
    /* advisory */
  }
}

function upsert(record: VaultCommitment): void {
  const all = readAll();
  const idx = all.findIndex((r) => r.nullifier === record.nullifier);
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
      })) as string;
      if (claimId && claimId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        return claimId;
      }
    }
  } catch {
    /* registry may not be deployed yet */
  }
  return undefined;
}

async function readClaimTimes(
  claimId: string
): Promise<{ issuedAt: number; expiresAt: number } | undefined> {
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) return undefined;
  try {
    const claim = (await publicClient.readContract({
      address: process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "getClaim",
      args: [claimId as `0x${string}`],
    })) as unknown as [unknown, unknown, unknown, unknown, unknown, bigint, bigint];
    return { issuedAt: Number(claim[5]), expiresAt: Number(claim[6]) };
  } catch {
    return undefined;
  }
}

// ── Service ───────────────────────────────────────────────────────────────

export function computeVaultNullifier(
  subject: `0x${string}`,
  fieldsHash: `0x${string}`
): `0x${string}` {
  return keccak256(
    encodePacked(["string", "address", "bytes32"], ["arcpass-id-vault", subject, fieldsHash])
  );
}

/**
 * Record a vault commitment on-chain. Authenticated: subject comes from the
 * signed-nonce middleware, not the request body.
 */
export async function commitVault(input: {
  subject: `0x${string}`;
  vaultCid: string;
  fieldsHash: `0x${string}`;
  documentType: string;
}): Promise<VaultCommitment> {
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) {
    throw Errors.IssuerNotConfigured("zk-vault", "ATTESTATION_REGISTRY_ADDRESS");
  }
  const walletId = process.env.CIRCLE_ZK_ISSUER_WALLET_ID || process.env.CIRCLE_ISSUER_WALLET_ID;
  if (!walletId) {
    throw Errors.IssuerNotConfigured("zk-vault", "CIRCLE_ZK_ISSUER_WALLET_ID");
  }

  const nullifier = computeVaultNullifier(input.subject, input.fieldsHash);

  // Replay/duplicate guard: one commitment per (wallet, document content).
  // Check BOTH local store (fast) AND on-chain state (survives Render redeploys
  // which wipe the JSONL — the on-chain source of truth).
  const all = readAll();
  const existing = all.find(
    (r) => r.nullifier === nullifier && r.claimId !== undefined
  );
  if (existing) {
    const stillValid = await isClaimValidOnChain(existing.claimId!);
    if (stillValid) {
      throw new ArcPassError(
        "VAULT_ALREADY_COMMITTED",
        "This document is already committed for this wallet",
        409
      );
    }
  }

  // On-chain-only guard: even if the JSONL was wiped, a valid on-chain claim
  // means the vault was already committed — skip re-attestation to avoid the
  // ArcPass__ActiveClaimExists revert (surfaced as "Circle: transaction failed").
  const onChainClaim = await recoverClaimId(input.subject, ID_VAULT_COMMITMENT_ID);
  if (onChainClaim && await isClaimValidOnChain(onChainClaim)) {
    const stillExisting = all.find((r) => r.claimId === onChainClaim);
    if (stillExisting) {
      throw new ArcPassError(
        "VAULT_ALREADY_COMMITTED",
        "This document is already committed for this wallet",
        409
      );
    }
    // JSONL was wiped but claim is on-chain — record it locally for future
    // fast-path checks, then return success without re-attesting.
    const times = await readClaimTimes(onChainClaim);
    const record: VaultCommitment = {
      subject: input.subject,
      vaultCid: input.vaultCid,
      fieldsHash: input.fieldsHash,
      documentType: input.documentType,
      nullifier,
      claimId: onChainClaim,
      committedAt: times?.issuedAt ?? Math.floor(Date.now() / 1000),
      expiresAt: times?.expiresAt ?? Math.floor(Date.now() / 1000) + VAULT_TTL_SECONDS,
    };
    upsert(record);
    return record;
  }

  const committedAt = Math.floor(Date.now() / 1000);
  const expiresAt = committedAt + VAULT_TTL_SECONDS;

  const record: VaultCommitment = {
    subject: input.subject,
    vaultCid: input.vaultCid,
    fieldsHash: input.fieldsHash,
    documentType: input.documentType,
    nullifier,
    committedAt,
    expiresAt,
  };
  upsert(record);

  const dataCommitment = keccak256(
    encodePacked(
      ["address", "bytes32", "string", "bool", "uint64"],
      [input.subject, nullifier, input.documentType, true, BigInt(committedAt)]
    )
  );

  let txHash: string;
  try {
    txHash = await executeContractCall(
      walletId,
      process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
      "attest(address,bytes32,bytes32,uint256)",
      [input.subject, ID_VAULT_COMMITMENT_ID, dataCommitment, expiresAt.toString()]
    );
  } catch (err) {
    record.claimId = undefined;
    record.txHash = undefined;
    upsert(record);
    throw Errors.AttestationFailed((err as Error).message || "vault commit failed");
  }

  const claimId = await recoverClaimId(input.subject, ID_VAULT_COMMITMENT_ID);

  const complete: VaultCommitment = {
    ...record,
    claimId: claimId ?? undefined,
    txHash,
  };
  upsert(complete);
  return complete;
}

/**
 * Get the vault commitment status for a wallet (on-chain validity checked).
 */
export async function getVaultStatus(
  subject: `0x${string}`
): Promise<{
  committed: boolean;
  documentType?: string;
  vaultCid?: string;
  fieldsHash?: string;
  committedAt?: number;
  expiresAt?: number;
  claimId?: string;
  txHash?: string;
  isValid: boolean;
}> {
  const all = readAll();
  const record = all
    .filter((r) => r.subject.toLowerCase() === subject.toLowerCase())
    .sort((a, b) => b.committedAt - a.committedAt)[0];

  if (!record) return { committed: false, isValid: false };

  const isValid = record.claimId ? await isClaimValidOnChain(record.claimId) : false;
  return {
    committed: true,
    documentType: record.documentType,
    vaultCid: record.vaultCid,
    fieldsHash: record.fieldsHash,
    committedAt: record.committedAt,
    expiresAt: record.expiresAt,
    claimId: record.claimId,
    txHash: record.txHash,
    isValid,
  };
}

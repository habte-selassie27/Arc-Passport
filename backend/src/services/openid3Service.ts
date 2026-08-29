import { randomUUID } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { keccak256, encodePacked } from "viem";
import { publicClient } from "./arcService.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { executeContractCall } from "./circleService.js";
import { Errors } from "../utils/errors.js";
import { SOCIAL_SCHEMAS } from "../constants/schemas.js";
import { type OpenID3Provider, type OpenID3ProviderId } from "./openid3Provider.js";
import { type DAuthResult, type VerifiedIdentity } from "../utils/dauthVerifier.js";

// ── Schema ──

const OPENID3_IDENTITY_ID = SOCIAL_SCHEMAS.OPENID3_IDENTITY.id!;
const IDENTITY_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

// ── Domain Types ──

export type OpenID3State = "initialized" | "pending" | "linked" | "attesting" | "complete" | "failed" | "expired";

export interface OpenID3Link {
  linkId: string;
  subject: string;
  state: OpenID3State;
  providerId: OpenID3ProviderId;
  providerName: string;
  accountHandle?: string;
  accountId?: string;
  nullifier?: string;
  claimId?: string;
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

// ── Persistence (advisory JSONL) ──

const STORE_PATH = join(process.cwd(), ".openid3-links.jsonl");

function readAll(): OpenID3Link[] {
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

function writeAll(records: OpenID3Link[]): void {
  try {
    writeFileSync(STORE_PATH, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  } catch { /* advisory */ }
}

function upsert(record: OpenID3Link): void {
  const all = readAll();
  const idx = all.findIndex((r) => r.linkId === record.linkId);
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
  } catch { /* best-effort */ }
  return undefined;
}

// ── Query helpers ──

export function getLink(linkId: string): OpenID3Link | undefined {
  return readAll().find((r) => r.linkId === linkId);
}

export function getLinkBySubject(subject: string): OpenID3Link | undefined {
  const lower = subject.toLowerCase();
  return readAll()
    .filter((r) => r.subject.toLowerCase() === lower)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export function getLinkByNullifier(nullifier: string): OpenID3Link | undefined {
  const lower = nullifier.toLowerCase();
  return readAll().find(
    (r) => r.nullifier && r.nullifier.toLowerCase() === lower && r.state === "complete"
  );
}

// ── Core Service ──

export async function startLinking(
  subject: `0x${string}`,
  providerId: OpenID3ProviderId,
  provider: OpenID3Provider
): Promise<{ linkId: string; authUrl: string }> {
  const existing = getLinkBySubject(subject);
  if (existing?.state === "complete" && existing.claimId) {
    const stillValid = await isClaimValidOnChain(existing.claimId);
    if (stillValid) {
      const session = await provider.createOAuthSession({ subject, providerId });
      return { linkId: existing.linkId, authUrl: session.authUrl };
    }
  }

  const linkId = randomUUID();
  const session = await provider.createOAuthSession({ subject, providerId });

  const record: OpenID3Link = {
    linkId,
    subject,
    state: "initialized",
    providerId,
    providerName: providerId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: session.expiresAt,
  };
  upsert(record);

  return { linkId, authUrl: session.authUrl };
}

export async function handleDAuthCallback(
  linkId: string,
  subject: `0x${string}`,
  dauthResult: DAuthResult,
  provider: OpenID3Provider
): Promise<OpenID3Link> {
  const record = getLink(linkId);
  if (!record) throw Errors.VerificationNotFound(linkId);
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

  // Verify the DAuth proof/JWT
  const verification = await provider.verifyDAuthResult(dauthResult, record.providerId);
  if (!verification.valid || !verification.identity) {
    record.state = "failed";
    record.error = verification.error ?? "DAuth verification failed";
    record.updatedAt = now;
    upsert(record);
    throw Errors.OpenID3ProviderFailed(verification.error ?? "Verification failed");
  }

  const { identity } = verification;

  // Compute nullifier for deduplication
  const nullifier = keccak256(
    encodePacked(["string", "string"], [identity.provider, identity.accountId])
  );
  const prior = getLinkByNullifier(nullifier);
  if (prior && prior.subject.toLowerCase() !== subject.toLowerCase()) {
    record.state = "failed";
    record.error = "Account already linked to another wallet";
    record.updatedAt = now;
    upsert(record);
    throw Errors.OpenID3AlreadyLinked();
  }

  record.state = "linked";
  record.accountHandle = identity.accountHandle;
  record.accountId = identity.accountId;
  record.nullifier = nullifier;
  record.providerName = identity.provider;
  record.updatedAt = now;
  upsert(record);

  // Issue on-chain attestation
  const walletId = process.env.CIRCLE_OPENID3_ISSUER_WALLET_ID;
  if (!walletId) {
    throw Errors.IssuerNotConfigured("openid3", "CIRCLE_OPENID3_ISSUER_WALLET_ID");
  }
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) {
    throw Errors.IssuerNotConfigured("openid3", "ATTESTATION_REGISTRY_ADDRESS");
  }

  const linkedAt = Math.floor(Date.now() / 1000);
  const expiresAt = linkedAt + IDENTITY_TTL_SECONDS;
  const dataCommitment = keccak256(
    encodePacked(
      ["address", "bytes32", "string", "bool", "uint64"],
      [subject, nullifier, identity.provider, identity.verified, BigInt(linkedAt)]
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
      [subject, OPENID3_IDENTITY_ID, dataCommitment, expiresAt.toString()]
    );
  } catch (err) {
    record.state = "failed";
    record.error = (err as Error).message;
    record.updatedAt = Date.now();
    upsert(record);
    throw Errors.AttestationFailed((err as Error).message);
  }

  const claimId = await recoverClaimId(subject, OPENID3_IDENTITY_ID);

  record.state = "complete";
  record.claimId = claimId ?? undefined;
  record.txHash = txHash;
  record.updatedAt = Date.now();
  upsert(record);

  return record;
}

export async function getOpenID3Status(
  address: string
): Promise<{ linked: boolean; provider?: string; accountHandle?: string; checkedAt?: number; expiresAt?: number; isHolder: boolean }> {
  const record = getLinkBySubject(address);
  if (!record || record.state !== "complete" || !record.claimId) {
    return { linked: false, isHolder: false };
  }

  const valid = await isClaimValidOnChain(record.claimId);
  return {
    linked: valid,
    provider: record.providerName,
    accountHandle: record.accountHandle,
    checkedAt: record.createdAt,
    expiresAt: record.expiresAt,
    isHolder: valid,
  };
}

export { MockOpenID3Provider } from "./openid3Provider.js";

import { signRequest } from "@worldcoin/idkit-server";
import { existsSync, readFileSync, appendFileSync } from "fs";
import { join } from "path";
import { ArcPassError, Errors } from "../utils/errors.js";
import { isClaimValidOnChain, claimExpiryOnChain } from "./humanityShared.js";
import {
  submitVerification,
  isUserHuman as isUserHumanOracle,
} from "./humanityOracleService.js";

const STORE_PATH = join(process.cwd(), ".world-id-nullifiers.jsonl");

/** Verify against the staging Developer Portal when WORLD_ID_ENVIRONMENT=staging. */
const WORLD_API_BASE =
  process.env.WORLD_ID_ENVIRONMENT === "staging"
    ? "https://staging-developer.worldcoin.org"
    : "https://developer.world.org";

// ── Advisory persistence ──

interface NullifierRecord {
  nullifier: string;
  subject: string;
  action: string;
  claimId?: string;
  txHash?: string;
  verifiedAt: number;
}

function readAll(): NullifierRecord[] {
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

function appendRecord(record: NullifierRecord): void {
  try {
    appendFileSync(STORE_PATH, JSON.stringify(record) + "\n");
  } catch {
    /* advisory */
  }
}

function findByNullifier(nullifier: string): NullifierRecord | undefined {
  const lower = nullifier.toLowerCase();
  return readAll().find((r) => r.nullifier.toLowerCase() === lower);
}

function findBySubject(subject: string): NullifierRecord | undefined {
  const lower = subject.toLowerCase();
  return readAll()
    .filter((r) => r.subject.toLowerCase() === lower)
    .sort((a, b) => b.verifiedAt - a.verifiedAt)[0];
}

// ── RP Signature ──

export interface RpSignature {
  sig: string;
  nonce: string;
  created_at: string;
  expires_at: string;
}

/**
 * Generate an RP (Relying Party) signature for a World ID proof request.
 * Uses the official SDK's EIP-191 secp256k1 signing (not HMAC).
 */
export function signRpRequest(action: string): RpSignature {
  const signingKey = process.env.WORLD_ID_SIGNING_KEY;
  if (!signingKey) {
    throw Errors.IssuerNotConfigured("world-id", "WORLD_ID_SIGNING_KEY");
  }

  const result = signRequest({ signingKeyHex: signingKey, action, ttl: 300 });

  return {
    sig: result.sig,
    nonce: result.nonce,
    created_at: result.createdAt.toString(),
    expires_at: result.expiresAt.toString(),
  };
}

// ── Proof Verification ──

export interface WorldIdVerifyPayload {
  proof: any;
  signal_hash?: string;
}

export interface VerifyResult {
  nullifier: string;
  verified: boolean;
}

/**
 * Forward the IDKit proof to the World ID Developer Portal for verification.
 * Returns the nullifier on success.
 */
async function verifyWithWorldApi(
  rpId: string,
  idkitResponse: any
): Promise<VerifyResult> {
  const res = await fetch(`${WORLD_API_BASE}/api/v4/verify/${rpId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(idkitResponse),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // World API errors carry a machine-readable code + human detail — surface both.
    const code = (body as any).code ?? res.status;
    const detail = (body as any).detail ?? JSON.stringify(body);
    throw new Error(`World ID verification failed [${code}]: ${detail}`);
  }

  const data = body as { success?: boolean; nullifier?: string };

  if (!data.success || !data.nullifier) {
    throw new Error("World ID: verification response missing nullifier");
  }

  return { nullifier: data.nullifier, verified: true };
}

// ── Public status ──

export interface WorldIdStatus {
  subject: string;
  verified: boolean;
  onChain: boolean;
  claimId?: string;
  mechanism?: string;
  checkedAt?: number;
  expiresAt?: number;
}

export async function getWorldIdStatus(address: `0x${string}`): Promise<WorldIdStatus> {
  // Check the oracle contract first (source of truth).
  const oracleHuman = await isUserHumanOracle(address);
  if (oracleHuman) {
    // Try to find the claim ID from the advisory store for metadata.
    const record = findBySubject(address);
    return {
      subject: address,
      verified: true,
      onChain: true,
      claimId: record?.claimId,
      mechanism: "worldid",
      checkedAt: record?.verifiedAt ?? Date.now(),
      expiresAt: record?.claimId ? await claimExpiryOnChain(record.claimId) : undefined,
    };
  }

  // Fallback: check advisory JSONL store for legacy records.
  const record = findBySubject(address);
  if (!record || !record.claimId) {
    return { subject: address, verified: false, onChain: false };
  }
  const onChain = await isClaimValidOnChain(record.claimId);
  const expiresAt = await claimExpiryOnChain(record.claimId);
  return {
    subject: address,
    verified: onChain,
    onChain,
    claimId: record.claimId,
    mechanism: "worldid",
    checkedAt: record.verifiedAt,
    expiresAt,
  };
}

// ── Config ──

export function getWorldIdConfig() {
  return {
    mechanism: "worldid",
    description:
      "Proof of Personhood via World App + Humanity Oracle. World App provides " +
      "biometric-grade proof (iris scan), then our on-chain Humanity Oracle " +
      "issues the HUMANITY_PROOF attestation on Arc. One human = one wallet.",
    schemaId: null, // uses HUMANITY_PROOF via oracle
    schemaName: "Humanity Proof",
    gateAddress: null,
    scoreWeight: 85,
  };
}

// ── Verify & Attest ──

export async function verifyAndAttest(
  subject: `0x${string}`,
  rpId: string,
  idkitResponse: any
): Promise<{ claimId?: string; txHash?: string; nullifier: string }> {
  const rpIdConfig = process.env.WORLD_ID_RP_ID;
  if (!rpIdConfig) {
    throw Errors.IssuerNotConfigured("world-id", "WORLD_ID_RP_ID");
  }
  if (rpId !== rpIdConfig) {
    throw new ArcPassError("INVALID_RP_ID", "RpId mismatch", 400);
  }

  // 1. Verify proof via World ID API — this confirms the nullifier is valid.
  let result: VerifyResult;
  try {
    result = await verifyWithWorldApi(rpId, idkitResponse);
  } catch (err) {
    throw Errors.ProviderVerifyFailed((err as Error).message);
  }

  // 2. Check nullifier uniqueness — one human → one wallet
  const prior = findByNullifier(result.nullifier);
  if (prior && prior.subject.toLowerCase() !== subject.toLowerCase()) {
    throw Errors.ProviderAlreadyBound();
  }

  // 3. Idempotent — if this wallet already has this nullifier verified, skip
  const existing = findBySubject(subject);
  if (existing && existing.nullifier?.toLowerCase() === result.nullifier.toLowerCase() && existing.claimId) {
    const stillValid = await isClaimValidOnChain(existing.claimId);
    if (stillValid) {
      return { claimId: existing.claimId, txHash: existing.txHash, nullifier: result.nullifier };
    }
  }

  // 4. Submit to HumanityOracle — the World ID nullifier serves as the
  //    biometric uniqueness anchor; the oracle enforces one-human-one-wallet
  //    on-chain and issues the HUMANITY_PROOF attestation.
  const oracleResult = await submitVerification({
    subject,
    isHuman: true,
    biometricHash: result.nullifier,
    challengeId: result.nullifier, // synthetic challenge — World App is the challenge
  });

  if (!oracleResult.success && oracleResult.error !== "already_verified") {
    throw new ArcPassError(
      "ORACLE_SUBMISSION_FAILED",
      oracleResult.error || "Oracle rejected World ID verification",
      500
    );
  }

  // 5. Persist nullifier record (advisory)
  appendRecord({
    nullifier: result.nullifier,
    subject,
    action: idkitResponse.action ?? "verify-humanity",
    claimId: oracleResult.attestationUID ?? existing?.claimId,
    txHash: existing?.txHash,
    verifiedAt: Date.now(),
  });

  return {
    claimId: oracleResult.attestationUID ?? existing?.claimId,
    txHash: existing?.txHash,
    nullifier: result.nullifier,
  };
}

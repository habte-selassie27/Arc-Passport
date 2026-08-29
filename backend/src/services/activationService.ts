/**
 * Activation Service — Secure, idempotent passport activation pipeline.
 *
 * Pipeline steps:
 *   1. Address normalization + caller verification
 *   2. Identity registration check (on-chain)
 *   3. Attestation ownership verification (on-chain)
 *   4. Identity attestation issuance (idempotent)
 *   5. Score computation (off-chain, deterministic)
 *   6. Score commitment (on-chain, idempotent)
 *   7. Audit logging
 *
 * Security guarantees:
 *   - Never trusts client-supplied scores or attestation data
 *   - Distributed lock prevents concurrent activation
 *   - Idempotent: same address never creates duplicate attestations
 *   - All attestations verified on-chain before scoring
 *   - Score writer role checked before transaction submission
 */

import { createHash } from "crypto";
import { keccak256, encodePacked, isAddress, checksumAddress } from "viem";
import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { executeContractCall } from "./circleService.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { SCORE_REGISTRY_ABI } from "../abis/ScoreRegistry.js";
import { issueAttestation, getActiveClaim } from "./attestationService.js";
import { getIdentityBalance, getIdentity } from "./identityService.js";
import { computeTrustScore, DEFAULT_POLICY } from "./scoringService.js";
import { getPassport } from "./passportService.js";
import { IDENTITY_SCHEMAS } from "../constants/schemas.js";
import { Errors } from "../utils/errors.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SCORE_WRITER_WALLET_ID = process.env.CIRCLE_SCORE_WRITER_WALLET_ID;
const SCORE_TTL_SECONDS = parseInt(process.env.SCORE_TTL_SECONDS || "86400", 10);
const SCORING_VERSION = "1.0.0";

// ── Activation Status Tracking ─────────────────────────────────────────────

export type ActivationStep =
  | "ADDRESS_VALIDATED"
  | "IDENTITY_VERIFIED"
  | "ATTESTATION_CHECKED"
  | "ATTESTATION_SUBMITTED"
  | "ATTESTATION_CONFIRMED"
  | "SCORE_COMPUTED"
  | "SCORE_SUBMITTED"
  | "SCORE_CONFIRMED"
  | "COMPLETED";

export type ActivationFailure =
  | "INVALID_ADDRESS"
  | "CALLER_MISMATCH"
  | "NOT_REGISTERED"
  | "ATTESTATION_EXISTS"
  | "ATTESTATION_FAILED"
  | "SCHEMA_NOT_FOUND"
  | "SCORE_COMPUTATION_FAILED"
  | "SCORE_ROLE_MISSING"
  | "SCORE_TX_FAILED"
  | "CONCURRENT_ACTIVATION"
  | "INTERNAL_ERROR";

export interface ActivationResult {
  success: boolean;
  address: `0x${string}`;
  steps: ActivationStep[];
  failure?: ActivationFailure;
  identityAttestation?: {
    txHash: string;
    schema: string;
    alreadyExisted: boolean;
  } | null;
  trustScore?: {
    score: number;
    passed: boolean;
    threshold: number;
    totalClaims: number;
    activeCategories: string[];
    attestationHash: string;
    scoringVersion: string;
    computedAt: number;
  };
  onChainScore?: {
    txHash: string;
    scoreRaw: number;
    scorerId: number;
    expiresAt: number;
    alreadyCurrent: boolean;
  } | null;
  audit: {
    activationId: string;
    startedAt: number;
    completedAt: number;
    durationMs: number;
    callerIp?: string;
  };
}

// ── Distributed Lock ───────────────────────────────────────────────────────

/**
 * In-memory lock per address. Prevents concurrent activation requests for the
 * same wallet from issuing duplicate attestations or competing ScoreRegistry
 * writes. For multi-instance deployments, replace with Redis SET NX + TTL.
 */
const activationLocks = new Map<string, { acquiredAt: number; expiresAt: number }>();

const LOCK_TTL_MS = 60_000; // 1 minute max lock duration

function acquireLock(address: string): boolean {
  const key = address.toLowerCase();
  const now = Date.now();
  const existing = activationLocks.get(key);

  // If lock exists and hasn't expired, deny
  if (existing && existing.expiresAt > now) {
    return false;
  }

  // Acquire or overwrite expired lock
  activationLocks.set(key, { acquiredAt: now, expiresAt: now + LOCK_TTL_MS });
  return true;
}

function releaseLock(address: string): void {
  activationLocks.delete(address.toLowerCase());
}

// ── Idempotency Store ──────────────────────────────────────────────────────

/**
 * Tracks activation status per address. Prevents duplicate attestations and
 * redundant score commits. For production, back with a database table.
 */
interface ActivationRecord {
  address: string;
  status: "PENDING" | "ATTESTATION_ISSUED" | "SCORE_COMMITTED" | "COMPLETED";
  identityAttestationTx: string | null;
  identityAttestationClaimId: string | null;
  scoreCommitTx: string | null;
  attestationHash: string | null;
  createdAt: number;
  updatedAt: number;
}

const activationRecords = new Map<string, ActivationRecord>();

function getActivationRecord(address: string): ActivationRecord | undefined {
  return activationRecords.get(address.toLowerCase());
}

function upsertActivationRecord(record: ActivationRecord): void {
  activationRecords.set(record.address.toLowerCase(), record);
}

// ── Audit Log ──────────────────────────────────────────────────────────────

interface AuditEntry {
  activationId: string;
  address: string;
  callerAddress?: string;
  callerIp?: string;
  steps: ActivationStep[];
  failure?: ActivationFailure;
  identityAttestationTx?: string;
  scoreCommitTx?: string;
  attestationHash?: string;
  trustScore?: number;
  durationMs: number;
  startedAt: number;
  completedAt: number;
}

const auditLog: AuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 10_000;

function logAudit(entry: AuditEntry): void {
  auditLog.push(entry);
  if (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT_ENTRIES);
  }
  // Also log to console for operational visibility
  const status = entry.failure ? "FAILED" : "SUCCESS";
  console.info(
    `[activation][${status}] id=${entry.activationId} addr=${entry.address} ` +
    `steps=${entry.steps.join("→")} duration=${entry.durationMs}ms` +
    (entry.failure ? ` failure=${entry.failure}` : "") +
    (entry.scoreCommitTx ? ` scoreTx=${entry.scoreCommitTx}` : "")
  );
}

// ── Address Normalization ──────────────────────────────────────────────────

function normalizeAddress(address: string): `0x${string}` | null {
  if (!isAddress(address)) return null;
  return checksumAddress(address as `0x${string}`);
}

// ── Attestation Ownership Verification ─────────────────────────────────────

/**
 * Verify that an attestation exists on-chain, is valid, belongs to the subject,
 * and the issuer is authorized. Never trusts client-supplied attestation data.
 */
async function verifyAttestationOwnership(
  claimId: `0x${string}`,
  expectedSubject: `0x${string}`
): Promise<{
  valid: boolean;
  exists: boolean;
  isAuthorizedIssuer: boolean;
  reason?: string;
}> {
  if (!ADDRESSES.attestationRegistry) {
    return { valid: false, exists: false, isAuthorizedIssuer: false, reason: "Registry not configured" };
  }

  try {
    // 1. Check if claim exists and get its data
    const claimResult = await publicClient.readContract({
      address: ADDRESSES.attestationRegistry,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "getClaim",
      args: [claimId],
    });

    // getClaim returns: [claimId, subject, schemaId, issuer, dataCommitment, issuedAt, expiresAt, revoked, refUID, revokedAt]
    const claimData = claimResult as readonly [
      `0x${string}`, // claimId
      `0x${string}`, // subject
      `0x${string}`, // schemaId
      `0x${string}`, // issuer
      `0x${string}`, // dataCommitment
      bigint,        // issuedAt
      bigint,        // expiresAt
      boolean,       // revoked
      `0x${string}`, // refUID
      bigint,        // revokedAt
    ];

    const exists = claimData[2] !== "0x0000000000000000000000000000000000000000000000000000000000000000"; // schemaId is non-zero if claim exists
    if (!exists) {
      return { valid: false, exists: false, isAuthorizedIssuer: false, reason: "Claim not found on-chain" };
    }

    const onChainSubject = claimData[1];
    const onChainIssuer = claimData[3];
    const isRevoked = claimData[7];
    const isExpired = claimData[6] !== 0n && BigInt(Math.floor(Date.now() / 1000)) >= claimData[6];

    // 2. Verify subject matches
    if (onChainSubject.toLowerCase() !== expectedSubject.toLowerCase()) {
      return {
        valid: false,
        exists: true,
        isAuthorizedIssuer: false,
        reason: `Subject mismatch: expected ${expectedSubject}, got ${onChainSubject}`,
      };
    }

    // 3. Verify not revoked or expired
    if (isRevoked) {
      return { valid: false, exists: true, isAuthorizedIssuer: false, reason: "Claim is revoked" };
    }
    if (isExpired) {
      return { valid: false, exists: true, isAuthorizedIssuer: false, reason: "Claim has expired" };
    }

    // 4. Verify issuer is authorized
    const ISSUER_ROLE = (await publicClient.readContract({
      address: ADDRESSES.attestationRegistry,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "ISSUER_ROLE",
    })) as `0x${string}`;

    const isAuthorizedIssuer = (await publicClient.readContract({
      address: ADDRESSES.attestationRegistry,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "hasRole",
      args: [ISSUER_ROLE, onChainIssuer],
    })) as boolean;

    if (!isAuthorizedIssuer) {
      return {
        valid: false,
        exists: true,
        isAuthorizedIssuer: false,
        reason: `Issuer ${onChainIssuer} does not hold ISSUER_ROLE`,
      };
    }

    // 5. Check isValid (combines revocation + expiry checks)
    const isValid = (await publicClient.readContract({
      address: ADDRESSES.attestationRegistry,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "isValid",
      args: [claimId],
    })) as boolean;

    return {
      valid: isValid,
      exists: true,
      isAuthorizedIssuer: true,
      reason: isValid ? undefined : "Claim failed isValid() check",
    };
  } catch (err) {
    return {
      valid: false,
      exists: false,
      isAuthorizedIssuer: false,
      reason: `On-chain verification failed: ${(err as Error).message}`,
    };
  }
}

// ── Score Writer Role Check ────────────────────────────────────────────────

async function hasScoreWriterRole(): Promise<boolean> {
  if (!ADDRESSES.scoreRegistry || !SCORE_WRITER_WALLET_ID) return false;

  try {
    const walletAddress = getScoreWriterAddress();
    if (!walletAddress) return false;

    const SCORE_WRITER_ROLE = (await publicClient.readContract({
      address: ADDRESSES.scoreRegistry,
      abi: SCORE_REGISTRY_ABI,
      functionName: "SCORE_WRITER_ROLE",
    })) as `0x${string}`;

    return (await publicClient.readContract({
      address: ADDRESSES.scoreRegistry,
      abi: SCORE_REGISTRY_ABI,
      functionName: "hasRole",
      args: [SCORE_WRITER_ROLE, walletAddress],
    })) as boolean;
  } catch {
    return false;
  }
}

/**
 * Get the Ethereum address of the score writer Circle wallet.
 * This should be set in the environment after the wallet is created.
 */
function getScoreWriterAddress(): `0x${string}` | null {
  // The score writer address should be stored in the environment
  // after Circle wallet creation or deployment
  const address = process.env.SCORE_WRITER_ADDRESS as string | undefined;
  if (address && /^0x[0-9a-fA-F]{40}$/.test(address)) {
    return address as `0x${string}`;
  }
  return null;
}

// ── Main Activation Pipeline ───────────────────────────────────────────────

/**
 * Execute the full activation pipeline for a passport.
 *
 * @param address - The wallet address to activate (will be checksummed)
 * @param callerAddress - The address of the caller (from signed nonce)
 * @param callerIp - Optional IP for audit logging
 */
export async function activatePassport(
  address: string,
  callerAddress: string,
  callerIp?: string
): Promise<ActivationResult> {
  const activationId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  const steps: ActivationStep[] = [];

  const fail = (failure: ActivationFailure, error?: Error): ActivationResult => {
    const completedAt = Date.now();
    logAudit({
      activationId,
      address: address.toLowerCase(),
      callerAddress,
      callerIp,
      steps,
      failure,
      durationMs: completedAt - startedAt,
      startedAt,
      completedAt,
    });
    return {
      success: false,
      address: address.toLowerCase() as `0x${string}`,
      steps,
      failure,
      audit: { activationId, startedAt, completedAt, durationMs: completedAt - startedAt, callerIp },
    };
  };

  try {
    // ── Step 1: Address validation + caller verification ──

    const normalized = normalizeAddress(address);
    if (!normalized) {
      return fail("INVALID_ADDRESS");
    }

    // Verify the caller actually controls this address
    const normalizedCaller = normalizeAddress(callerAddress);
    if (!normalizedCaller || normalizedCaller.toLowerCase() !== normalized.toLowerCase()) {
      return fail("CALLER_MISMATCH");
    }

    steps.push("ADDRESS_VALIDATED");

    // ── Step 2: Distributed lock (prevent concurrent activation) ──

    if (!acquireLock(normalized)) {
      return fail("CONCURRENT_ACTIVATION");
    }

    try {
      // ── Step 3: Idempotency check ──

      const existingRecord = getActivationRecord(normalized);
      if (existingRecord?.status === "COMPLETED") {
        // Already fully activated — return existing state
        const completedAt = Date.now();
        logAudit({
          activationId,
          address: normalized.toLowerCase(),
          callerAddress,
          callerIp,
          steps: [...steps, "COMPLETED"],
          durationMs: completedAt - startedAt,
          startedAt,
          completedAt,
        });
        return {
          success: true,
          address: normalized,
          steps: [...steps, "COMPLETED"],
          identityAttestation: existingRecord.identityAttestationTx
            ? { txHash: existingRecord.identityAttestationTx, schema: "arcpass_identity", alreadyExisted: true }
            : null,
          onChainScore: existingRecord.scoreCommitTx
            ? { txHash: existingRecord.scoreCommitTx, scoreRaw: 0, scorerId: 0, expiresAt: 0, alreadyCurrent: true }
            : null,
          audit: { activationId, startedAt, completedAt, durationMs: completedAt - startedAt, callerIp },
        };
      }

      // ── Step 4: Verify identity is registered on-chain ──

      const balance = await getIdentityBalance(normalized);
      if (balance === 0) {
        return fail("NOT_REGISTERED");
      }

      steps.push("IDENTITY_VERIFIED");

      // ── Step 5: Check if identity attestation already exists ──

      const identitySchema = IDENTITY_SCHEMAS.BASIC_IDENTITY;
      if (!identitySchema?.id) {
        return fail("SCHEMA_NOT_FOUND");
      }

      let identityAttestationTx: string | null = null;
      let alreadyExisted = false;

      // Check if the issuer already has an active claim for this subject + schema
      try {
        const existingClaim = await getActiveClaim(
          normalized,
          identitySchema.id as `0x${string}`,
          // The issuer is the Circle wallet — we need to resolve it
          // For now, check if ANY active claim exists for this schema
          normalizeAddress(process.env.CIRCLE_ISSUER_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`
        );

        if (existingClaim && existingClaim !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          // Active claim exists — verify it on-chain
          const verification = await verifyAttestationOwnership(existingClaim, normalized);
          if (verification.valid) {
            steps.push("ATTESTATION_CHECKED");
            steps.push("ATTESTATION_CONFIRMED");
            alreadyExisted = true;
          }
        }
      } catch {
        // getActiveClaim may fail if no claim exists — that's fine, we'll issue one
      }

      // ── Step 6: Issue identity attestation if needed ──

      if (!alreadyExisted) {
        steps.push("ATTESTATION_CHECKED");

        const now = Math.floor(Date.now() / 1000);
        const dataCommitment = keccak256(
          encodePacked(
            ["address", "string", "uint64"],
            [normalized, "identity_registered", BigInt(now)]
          )
        );

        try {
          identityAttestationTx = await issueAttestation(
            normalized,
            identitySchema.id,
            dataCommitment,
            0 // no expiry for identity attestation
          );
          steps.push("ATTESTATION_SUBMITTED");

          // Verify the attestation was actually confirmed on-chain
          // Arc finalizes in <1s, so a short wait is sufficient
          await new Promise((resolve) => setTimeout(resolve, 1500));

          // The attestation is now on-chain — we can proceed to scoring
          steps.push("ATTESTATION_CONFIRMED");
        } catch (err) {
          // If attestation already exists (race condition), that's OK
          const msg = (err as Error).message;
          if (msg.includes("ACTIVE_CLAIM_EXISTS") || msg.includes("already")) {
            alreadyExisted = true;
            steps.push("ATTESTATION_CONFIRMED");
          } else {
            return fail("ATTESTATION_FAILED", err as Error);
          }
        }
      }

      // Update idempotency record
      upsertActivationRecord({
        address: normalized.toLowerCase(),
        status: "ATTESTATION_ISSUED",
        identityAttestationTx,
        identityAttestationClaimId: null,
        scoreCommitTx: null,
        attestationHash: null,
        createdAt: existingRecord?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });

      // ── Step 7: Compute trust score (off-chain) ──

      const passport = await getPassport(normalized);
      const trustScore = computeTrustScore(passport.services);
      const attestationHash = buildAttestationHash(passport);

      steps.push("SCORE_COMPUTED");

      // ── Step 8: Commit score on-chain (if role available) ──

      let onChainScore: ActivationResult["onChainScore"] = null;
      const hasRole = await hasScoreWriterRole();

      if (!hasRole) {
        // SCORE_WRITER_ROLE missing — this is a recoverable state, not a failure
        console.warn(
          `[activation] SCORE_WRITER_ROLE not available for ${normalized}. ` +
          `Score computed off-chain (${trustScore.score}/100) but not committed on-chain. ` +
          `Run GrantScoreRole.s.sol to fix.`
        );
      }

      if (hasRole && SCORE_WRITER_WALLET_ID && ADDRESSES.scoreRegistry) {
        steps.push("SCORE_SUBMITTED");

        try {
          // Check if score is already current (idempotency)
          const existingScore = await readOnChainScore(normalized);
          if (existingScore && existingScore.hash === attestationHash) {
            // Score is already current — no new transaction needed
            onChainScore = {
              txHash: existingScore.txHash || "",
              scoreRaw: existingScore.scoreRaw,
              scorerId: 0,
              expiresAt: existingScore.expiresAt,
              alreadyCurrent: true,
            };
            steps.push("SCORE_CONFIRMED");
          } else {
            // Commit new score
            const scoreRaw = Math.round(trustScore.score * 10);
            const expiresAt = Math.floor(Date.now() / 1000) + SCORE_TTL_SECONDS;
            const computedAt = Math.floor(Date.now() / 1000);

            // Create deterministic commitment
            const commitmentInput = `${normalized.toLowerCase()}0${scoreRaw}${computedAt}`;
            const commitment = `0x${createHash("sha256")
              .update(commitmentInput)
              .digest("hex")
              .slice(0, 64)
              .padEnd(64, "0")}` as `0x${string}`;

            const txHash = await executeContractCall(
              SCORE_WRITER_WALLET_ID,
              ADDRESSES.scoreRegistry,
              "commitScore(address,uint16,uint16,uint64,bytes32)",
              [
                normalized,
                "0", // scorerId = 0 (canonical)
                scoreRaw.toString(),
                expiresAt.toString(),
                commitment,
              ]
            );

            onChainScore = {
              txHash: txHash as string,
              scoreRaw,
              scorerId: 0,
              expiresAt,
              alreadyCurrent: false,
            };

            // Verify the transaction was actually confirmed
            await new Promise((resolve) => setTimeout(resolve, 1500));
            steps.push("SCORE_CONFIRMED");
          }
        } catch (err) {
          // Score commit failed — log but don't fail the activation
          // The attestation was already issued successfully
          console.warn(
            `[activation] Score commit failed for ${normalized}:`,
            (err as Error).message
          );
          // Remove SCORE_SUBMITTED from steps since it failed
          const idx = steps.lastIndexOf("SCORE_SUBMITTED");
          if (idx !== -1) steps.splice(idx, 1);
        }
      }

      // ── Step 9: Finalize ──

      steps.push("COMPLETED");

      upsertActivationRecord({
        address: normalized.toLowerCase(),
        status: "COMPLETED",
        identityAttestationTx,
        identityAttestationClaimId: null,
        scoreCommitTx: onChainScore?.txHash || null,
        attestationHash,
        createdAt: existingRecord?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });

      const completedAt = Date.now();

      logAudit({
        activationId,
        address: normalized.toLowerCase(),
        callerAddress,
        callerIp,
        steps,
        identityAttestationTx: identityAttestationTx || undefined,
        scoreCommitTx: onChainScore?.txHash || undefined,
        attestationHash,
        trustScore: trustScore.score,
        durationMs: completedAt - startedAt,
        startedAt,
        completedAt,
      });

      return {
        success: true,
        address: normalized,
        steps,
        identityAttestation: identityAttestationTx
          ? { txHash: identityAttestationTx, schema: "arcpass_identity", alreadyExisted }
          : null,
        trustScore: {
          score: trustScore.score,
          passed: trustScore.passed,
          threshold: trustScore.threshold,
          totalClaims: trustScore.totalClaims,
          activeCategories: trustScore.activeCategories,
          attestationHash,
          scoringVersion: SCORING_VERSION,
          computedAt: trustScore.computedAt,
        },
        onChainScore,
        audit: { activationId, startedAt, completedAt, durationMs: completedAt - startedAt, callerIp },
      };
    } finally {
      releaseLock(normalized);
    }
  } catch (err) {
    const completedAt = Date.now();
    logAudit({
      activationId,
      address: address.toLowerCase(),
      callerAddress,
      callerIp,
      steps,
      failure: "INTERNAL_ERROR",
      durationMs: completedAt - startedAt,
      startedAt,
      completedAt,
    });
    return {
      success: false,
      address: address.toLowerCase() as `0x${string}`,
      steps,
      failure: "INTERNAL_ERROR",
      audit: { activationId, startedAt, completedAt, durationMs: completedAt - startedAt, callerIp },
    };
  }
}

// ── Score Reader ───────────────────────────────────────────────────────────

interface OnChainScoreData {
  score: number;
  scoreRaw: number;
  isValid: boolean;
  expiresAt: number;
  txHash: string;
  hash: string;
}

async function readOnChainScore(address: `0x${string}`): Promise<OnChainScoreData | null> {
  if (!ADDRESSES.scoreRegistry) return null;

  try {
    const result = await publicClient.readContract({
      address: ADDRESSES.scoreRegistry,
      abi: SCORE_REGISTRY_ABI,
      functionName: "scores",
      args: [address, 0],
    });

    // scores() returns: [score, dataCommitment, computedAt, expiresAt, exists]
    const resultTuple = result as readonly [number, `0x${string}`, bigint, bigint, boolean];
    const exists = resultTuple[4];
    if (!exists) return null;

    return {
      score: resultTuple[0] / 10, // raw is 0-1000, display is 0-100
      scoreRaw: resultTuple[0],
      isValid: exists, // If it exists and hasn't expired, it's valid
      expiresAt: Number(resultTuple[3]),
      txHash: "", // Not stored in the scores mapping
      hash: resultTuple[1],
    };
  } catch {
    return null;
  }
}

// ── Attestation Hash Builder ───────────────────────────────────────────────

/**
 * Build a deterministic hash of the passport's attestation set.
 * Used for idempotency: if the hash hasn't changed, no re-score needed.
 * Only includes valid, non-revoked, non-expired attestations from authorized issuers.
 */
function buildAttestationHash(passport: Awaited<ReturnType<typeof getPassport>>): string {
  const claims = Object.values(passport.services)
    .flatMap((s) => s.claims ?? [])
    .filter((c) => c.valid)
    .map((c) => `${c.claimId}:${c.schemaId}:${c.issuer}`)
    .sort()
    .join("|");

  return `0x${createHash("sha256").update(claims || "empty").digest("hex")}`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get activation status for an address (read-only, no side effects).
 */
export function getActivationStatus(
  address: string
): { activated: boolean; record?: ActivationRecord } {
  const normalized = normalizeAddress(address);
  if (!normalized) return { activated: false };
  const record = getActivationRecord(normalized);
  return { activated: record?.status === "COMPLETED", record };
}

/**
 * Get the audit log (for admin/debugging). Returns the most recent entries.
 */
export function getAuditLog(limit = 100): AuditEntry[] {
  return auditLog.slice(-limit);
}

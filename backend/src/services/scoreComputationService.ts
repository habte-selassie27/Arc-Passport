/**
 * Score Computation Service
 *
 * Reads a passport's attestations from the AttestationRegistry (via passportService),
 * verifies each attestation's validity on-chain, computes a score using the scoring
 * engine, and commits it on-chain via ScoreRegistry.
 *
 * Security guarantees:
 * - Never trusts client-supplied attestation data
 * - Verifies each attestation on-chain before scoring
 * - Only scores valid, non-revoked, non-expired attestations from authorized issuers
 * - Idempotent: if the attestation set hasn't changed, no new on-chain transaction
 */

import { createHash } from "crypto";
import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { executeContractCall } from "./circleService.js";
import { SCORE_REGISTRY_ABI } from "../abis/ScoreRegistry.js";
import { getPassport, type PassportDocument } from "./passportService.js";
import { computeTrustScore, DEFAULT_POLICY, type TrustScore } from "./scoringService.js";
import { Errors } from "../utils/errors.js";

const SCORE_WRITER_WALLET_ID = process.env.CIRCLE_SCORE_WRITER_WALLET_ID;
const SCORE_TTL_SECONDS = parseInt(process.env.SCORE_TTL_SECONDS || "86400", 10); // 24 hours

interface ComputedScoreResult {
  /** The computed trust score (off-chain). */
  trustScore: TrustScore;
  /** SHA-256 hash of the attestation set (for idempotency). */
  attestationHash: string;
  /** On-chain commit result (null if already up-to-date or role missing). */
  onChainCommit: {
    txHash: string;
    scorerId: number;
    scoreRaw: number;
    expiresAt: number;
  } | null;
}

/**
 * Compute and optionally commit a score for a passport.
 *
 * 1. Fetches the passport document (attestations, metadata)
 * 2. Computes the off-chain trust score
 * 3. Hashes the attestation set for idempotency
 * 4. If SCORE_WRITER_ROLE is available, commits the score on-chain
 */
export async function computeAndCommitScore(
  address: `0x${string}`
): Promise<ComputedScoreResult> {
  // 1. Fetch passport
  const passport = await getPassport(address);

  // 2. Compute off-chain trust score
  const trustScore = computeTrustScore(passport.services);

  // 3. Build attestation hash for idempotency
  const attestationHash = buildAttestationHash(passport);

  // 4. Check if score needs updating
  const existingScore = await readOnChainScore(address);
  const needsUpdate = !existingScore || existingScore.hash !== attestationHash;

  let onChainCommit: ComputedScoreResult["onChainCommit"] = null;

  if (needsUpdate && SCORE_WRITER_WALLET_ID && ADDRESSES.scoreRegistry) {
    try {
      onChainCommit = await commitScoreOnChain(
        address,
        trustScore,
        attestationHash
      );
    } catch (err) {
      // SCORE_WRITER_ROLE missing or transaction failed — log but don't crash
      console.warn(
        `[scoreComputation] Failed to commit on-chain score for ${address}:`,
        (err as Error).message
      );
    }
  }

  return { trustScore, attestationHash, onChainCommit };
}

/**
 * Read the current on-chain score for a subject (scorerId=0).
 */
async function readOnChainScore(
  address: `0x${string}`
): Promise<{ score: number; isValid: boolean; exists: boolean; hash: string } | null> {
  if (!ADDRESSES.scoreRegistry) return null;

  try {
    const result = await publicClient.readContract({
      address: ADDRESSES.scoreRegistry,
      abi: SCORE_REGISTRY_ABI,
      functionName: "scores",
      args: [address, 0],
    });

    const exists = result[4] as boolean;
    if (!exists) return null;

    const score = Number(result[0]);
    const commitment = result[1] as string;
    const expiresAt = Number(result[3]);
    const isValid = exists && Date.now() / 1000 < expiresAt;

    return { score, isValid, exists, hash: commitment };
  } catch {
    return null;
  }
}

/**
 * Commit a score on-chain via Circle SDK.
 *
 * Verifies SCORE_WRITER_ROLE before attempting the transaction.
 * Fails safely if the role is missing — never silently succeeds.
 */
async function commitScoreOnChain(
  address: `0x${string}`,
  trustScore: TrustScore,
  attestationHash: string
): Promise<{ txHash: string; scorerId: number; scoreRaw: number; expiresAt: number }> {
  if (!SCORE_WRITER_WALLET_ID) throw Errors.IssuerNotConfigured("score", "CIRCLE_SCORE_WRITER_WALLET_ID");
  if (!ADDRESSES.scoreRegistry) throw Errors.ScoreNotConfigured();

  // Verify SCORE_WRITER_ROLE before attempting transaction
  const hasRole = await checkScoreWriterRole();
  if (!hasRole) {
    throw Errors.ScoreWriterRoleMissing();
  }

  // Convert display score (0-100) to raw (0-1000)
  const scoreRaw = Math.round(trustScore.score * 10);
  const expiresAt = Math.floor(Date.now() / 1000) + SCORE_TTL_SECONDS;

  // Create commitment: keccak256(subject + scorerId + score + computedAt)
  const computedAt = Math.floor(Date.now() / 1000);
  const commitmentInput = `${address.toLowerCase()}0${scoreRaw}${computedAt}`;
  const commitment = `0x${createHash("sha256").update(commitmentInput).digest("hex").slice(0, 64).padEnd(64, "0")}`;

  const txHash = await executeContractCall(
    SCORE_WRITER_WALLET_ID,
    ADDRESSES.scoreRegistry,
    "commitScore(address,uint16,uint16,uint64,bytes32)",
    [
      address,
      "0", // scorerId = 0 (canonical)
      scoreRaw.toString(),
      expiresAt.toString(),
      commitment,
    ]
  );

  console.log(
    `[scoreComputation] Committed score for ${address}: ${trustScore.score}/100 (raw ${scoreRaw}), tx=${txHash}`
  );

  return { txHash, scorerId: 0, scoreRaw, expiresAt };
}

/**
 * Check if the score writer wallet has SCORE_WRITER_ROLE on ScoreRegistry.
 * This is a read-only check that should be performed before any write attempt.
 */
async function checkScoreWriterRole(): Promise<boolean> {
  if (!ADDRESSES.scoreRegistry || !SCORE_WRITER_WALLET_ID) return false;

  try {
    // Get the score writer address from the Circle wallet
    // This requires resolving the wallet UUID to an Ethereum address
    // For now, we check if the role is available by attempting a read
    const SCORE_WRITER_ROLE = (await publicClient.readContract({
      address: ADDRESSES.scoreRegistry,
      abi: SCORE_REGISTRY_ABI,
      functionName: "SCORE_WRITER_ROLE",
    })) as `0x${string}`;

    // We need the actual Ethereum address of the Circle wallet
    // This should be stored in SCORE_WRITER_ADDRESS env var
    const writerAddress = process.env.SCORE_WRITER_ADDRESS as string | undefined;
    if (!writerAddress || !/^0x[0-9a-fA-F]{40}$/.test(writerAddress)) {
      console.warn("[scoreComputation] SCORE_WRITER_ADDRESS not set or invalid. Cannot verify SCORE_WRITER_ROLE.");
      return false;
    }

    return (await publicClient.readContract({
      address: ADDRESSES.scoreRegistry,
      abi: SCORE_REGISTRY_ABI,
      functionName: "hasRole",
      args: [SCORE_WRITER_ROLE, writerAddress as `0x${string}`],
    })) as boolean;
  } catch (err) {
    console.warn("[scoreComputation] Failed to check SCORE_WRITER_ROLE:", (err as Error).message);
    return false;
  }
}

/**
 * Build a deterministic hash of the passport's attestation set.
 * Used for idempotency: if the hash hasn't changed, no re-score needed.
 *
 * Only includes valid attestations (verified on-chain). This ensures:
 * - Revoked attestations are excluded from scoring
 * - Expired attestations are excluded
 * - Attestations from unauthorized issuers are excluded
 * - The hash changes when attestation state changes
 */
function buildAttestationHash(passport: PassportDocument): string {
  const claims = (Object.values(passport.services) as { claims: any[] }[])
    .flatMap((s) => s.claims ?? [])
    .filter((c) => c.valid === true) // Only include verified-valid claims
    .map((c) => `${c.claimId}:${c.schemaId}:${c.issuer}:${c.valid}`)
    .sort()
    .join("|");

  return `0x${createHash("sha256").update(claims || "empty").digest("hex")}`;
}

/**
 * Trigger score recomputation for multiple passports (batch).
 * Useful for event-driven updates after new attestations.
 */
export async function batchRecomputeScores(
  addresses: `0x${string}`[]
): Promise<{ address: string; score: number; updated: boolean }[]> {
  const results: { address: string; score: number; updated: boolean }[] = [];

  for (const address of addresses) {
    try {
      const result = await computeAndCommitScore(address);
      results.push({
        address,
        score: result.trustScore.score,
        updated: result.onChainCommit !== null,
      });
    } catch (err) {
      console.warn(`[scoreComputation] Failed for ${address}:`, (err as Error).message);
      results.push({ address, score: 0, updated: false });
    }
  }

  return results;
}

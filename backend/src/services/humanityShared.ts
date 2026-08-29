/**
 * humanityShared.ts
 *
 * Shared helpers for Humanity Proof verification across mechanisms.
 * - On-chain claim reads (validity / expiry / recovery)
 * - Attestation issuance via the configured Circle issuer wallet
 *
 * Used by worldIdService (World ID) and livenessService (camera liveness).
 * The HUMANITY_PROOF schema is shared: verified / mechanism / nullifier /
 * checkedAt. Privacy: raw frames or provider payloads are never persisted —
 * only commitments and metadata land in records (AGENTS.md §7).
 */
import { keccak256, encodePacked } from "viem";
import { publicClient } from "./arcService.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { executeContractCall } from "./circleService.js";
import { Errors } from "../utils/errors.js";
import { SOCIAL_SCHEMAS } from "../constants/schemas.js";

export const HUMANITY_PROOF_ID = SOCIAL_SCHEMAS.HUMANITY_PROOF.id!;

export function humanityAttestationTtlSeconds(): number {
  return parseInt(process.env.HUMANITY_ATTESTATION_TTL_SECONDS || "15552000", 10);
}

// ── On-chain reads ──

export async function isClaimValidOnChain(claimId: string): Promise<boolean> {
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

export async function claimExpiryOnChain(claimId: string): Promise<number | undefined> {
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) return undefined;
  try {
    const c = (await publicClient.readContract({
      address: process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "getClaim",
      args: [claimId as `0x${string}`],
    })) as any;
    return Number(c[6]);
  } catch {
    return undefined;
  }
}

export async function recoverClaimId(
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

// ── Attestation issuance (shared) ──

export interface IssueAttestationResult {
  claimId?: string;
  txHash: string;
}

/**
 * Issue the on-chain HUMANITY_PROOF attestation for a verified subject.
 * `mechanism` identifies the verification path ("worldid", "liveness-web", ...).
 * `nullifier32` is a bytes32 uniqueness/dedup anchor scoped to the mechanism.
 * No biometric payload is ever stored on-chain or on disk — only this metadata
 * is recorded by the caller.
 */
export async function issueHumanityAttestation(args: {
  subject: `0x${string}`;
  mechanism: string;
  nullifier32: string;
}): Promise<IssueAttestationResult> {
  const walletId = process.env.CIRCLE_HUMANITY_ISSUER_WALLET_ID;
  if (!walletId) {
    throw Errors.IssuerNotConfigured("humanity", "CIRCLE_HUMANITY_ISSUER_WALLET_ID");
  }
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) {
    throw Errors.ScoreNotConfigured();
  }

  const subject = args.subject;
  const nullifier32 = args.nullifier32 as `0x${string}`;

  // Idempotency guard: one active humanity attestation per subject.
  const existingClaimId = await recoverClaimId(subject, HUMANITY_PROOF_ID);
  if (existingClaimId) {
    const stillValid = await isClaimValidOnChain(existingClaimId);
    if (stillValid) {
      return { claimId: existingClaimId, txHash: "" }; // already attested, nothing to do
    }
  }

  const checkedAt = Math.floor(Date.now() / 1000);
  const expiresAt = checkedAt + humanityAttestationTtlSeconds();
  const dataCommitment = keccak256(
    encodePacked(
      ["address", "bytes32", "string", "uint64"],
      [subject, nullifier32, args.mechanism, BigInt(checkedAt)]
    )
  );

  let txHash: string;
  try {
    txHash = await executeContractCall(
      walletId,
      process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
      "attest(address,bytes32,bytes32,uint256)",
      [subject, HUMANITY_PROOF_ID, dataCommitment, expiresAt.toString()]
    );
  } catch (err) {
    throw Errors.AttestationFailed((err as Error).message);
  }

  const claimId = await recoverClaimId(subject, HUMANITY_PROOF_ID);
  return { claimId: claimId ?? undefined, txHash };
}

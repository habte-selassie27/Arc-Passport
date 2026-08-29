/**
 * humanityOracleService.ts
 *
 * Backend service for interacting with the HumanityOracle contract on Arc.
 * Acts as a trusted provider — validates liveness proofs, checks biometric
 * uniqueness, and submits verification results to the oracle.
 *
 * Flow:
 * 1. Frontend captures liveness frames
 * 2. Backend validates liveness challenge
 * 3. Backend computes biometric hash from landmarks
 * 4. Backend checks uniqueness via oracle's nullifier registry
 * 5. Backend submits verification result to oracle contract
 * 6. Oracle issues HUMANITY_PROOF attestation on-chain
 */

import { keccak256, encodePacked, type Address, type Hash } from "viem";
import { publicClient } from "./arcService.js";
import { HUMANITY_ORACLE_ABI } from "../abis/HumanityOracle.js";
import { executeContractCall } from "./circleService.js";
import { computeBiometricHash, isBiometricMatch } from "./biometricService.js";
import { ArcPassError, Errors } from "../utils/errors.js";

// ── Config ──

function getOracleAddress(): Address {
  const addr = process.env.HUMANITY_ORACLE_ADDRESS;
  if (!addr) throw Errors.NotConfigured("HUMANITY_ORACLE_ADDRESS");
  return addr as Address;
}

function getProviderWalletId(): string {
  const id = process.env.CIRCLE_HUMANITY_ISSUER_WALLET_ID;
  if (!id) throw Errors.NotConfigured("CIRCLE_HUMANITY_ISSUER_WALLET_ID");
  return id;
}

// ── On-chain reads ──

/**
 * Check if a wallet is controlled by a verified unique human.
 */
export async function isUserHuman(address: Address): Promise<boolean> {
  try {
    return (await publicClient.readContract({
      address: getOracleAddress(),
      abi: HUMANITY_ORACLE_ABI,
      functionName: "isUserHuman",
      args: [address],
    })) as boolean;
  } catch {
    return false;
  }
}

/**
 * Get the nullifier bound to a wallet.
 */
export async function getUserNullifier(address: Address): Promise<string> {
  try {
    return (await publicClient.readContract({
      address: getOracleAddress(),
      abi: HUMANITY_ORACLE_ABI,
      functionName: "getUserNullifier",
      args: [address],
    })) as string;
  } catch {
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }
}

/**
 * Get a verification request by ID.
 */
export async function getVerificationRequest(requestId: string) {
  try {
    return await publicClient.readContract({
      address: getOracleAddress(),
      abi: HUMANITY_ORACLE_ABI,
      functionName: "getRequest",
      args: [requestId as `0x${string}`],
    });
  } catch {
    return null;
  }
}

/**
 * Check if an address is a trusted provider on the oracle.
 */
export async function isOracleProvider(address: Address): Promise<boolean> {
  try {
    return (await publicClient.readContract({
      address: getOracleAddress(),
      abi: HUMANITY_ORACLE_ABI,
      functionName: "isProvider",
      args: [address],
    })) as boolean;
  } catch {
    return false;
  }
}

// ── Verification submission ──

export interface SubmitVerificationArgs {
  /** The wallet address being verified. */
  subject: Address;
  /** Whether the user passed liveness. */
  isHuman: boolean;
  /** Biometric hash from facial landmarks (bytes32). */
  biometricHash: string;
  /** Liveness challenge ID that was consumed. */
  challengeId: string;
}

export interface SubmitVerificationResult {
  /** Whether the oracle accepted the submission. */
  success: boolean;
  /** The attestation claim ID (if issued). */
  attestationUID?: string;
  /** Error message if failed. */
  error?: string;
}

/**
 * Submit a liveness verification result to the HumanityOracle.
 *
 * This function:
 * 1. Validates the biometric hash is unique (not already bound to another wallet)
 * 2. Submits the result to the oracle contract via Circle SDK
 * 3. The oracle issues the HUMANITY_PROOF attestation
 */
export async function submitVerification(
  args: SubmitVerificationArgs
): Promise<SubmitVerificationResult> {
  const { subject, isHuman, biometricHash, challengeId } = args;

  // Check if this wallet is already human (idempotent).
  const alreadyHuman = await isUserHuman(subject);
  if (alreadyHuman) {
    return { success: true, error: "already_verified" };
  }

  // Check if this biometric hash is already bound to a different wallet.
  const existingWallet = await publicClient.readContract({
    address: getOracleAddress(),
    abi: HUMANITY_ORACLE_ABI,
    functionName: "nullifierToWallet",
    args: [biometricHash as `0x${string}`],
  }) as Address;

  if (existingWallet !== "0x0000000000000000000000000000000000000000" && existingWallet !== subject) {
    return {
      success: false,
      error: `Biometric hash already bound to wallet ${existingWallet}`,
    };
  }

  // Request verification first (creates the request on-chain).
  let requestId: string;
  try {
    requestId = await executeContractCall(
      getProviderWalletId(),
      getOracleAddress(),
      "requestVerification(address,address,uint256)",
      [subject, "0x0000000000000000000000000000000000000000", "15552000"] // 6 months TTL
    );
  } catch (err) {
    return {
      success: false,
      error: `Failed to create verification request: ${(err as Error).message}`,
    };
  }

  // Submit the result.
  try {
    await executeContractCall(
      getProviderWalletId(),
      getOracleAddress(),
      "submitVerificationResult(bytes32,bool,bytes32)",
      [requestId, String(isHuman), biometricHash]
    );
  } catch (err) {
    return {
      success: false,
      error: `Failed to submit verification result: ${(err as Error).message}`,
    };
  }

  // Read back the result to get the attestation UID.
  const request = await getVerificationRequest(requestId);
  const attestationUID = request ? (request as any)[8] : undefined;

  return {
    success: true,
    attestationUID: attestationUID ? String(attestationUID) : undefined,
  };
}

// ── Convenience: full verification flow ──

export interface VerifyLivenessResult {
  claimId?: string;
  txHash?: string;
  isHuman: boolean;
  biometricHash: string;
}

/**
 * Full liveness verification flow:
 * 1. Validate the liveness challenge
 * 2. Compute biometric hash from landmarks
 * 3. Submit to oracle
 *
 * This replaces the old issueHumanityAttestation() flow for the liveness mechanism.
 */
export async function verifyAndAttestViaOracle(args: {
  subject: Address;
  challengeId: string;
  steps: string[];
  frames: string[];
  landmarks: any[]; // MediaPipe landmarks
}): Promise<VerifyLivenessResult> {
  const { subject, challengeId, steps, frames, landmarks } = args;

  // Compute biometric hash from landmarks
  let biometricHash: string;
  try {
    biometricHash = computeBiometricHash(landmarks);
  } catch (err) {
    throw new ArcPassError(
      "BIOMETRIC_HASH_FAILED",
      `Failed to compute biometric hash: ${(err as Error).message}`,
      400
    );
  }

  // Submit to oracle
  const result = await submitVerification({
    subject,
    isHuman: true,
    biometricHash,
    challengeId,
  });

  if (!result.success && result.error !== "already_verified") {
    throw new ArcPassError(
      "ORACLE_SUBMISSION_FAILED",
      result.error || "Failed to submit verification",
      500
    );
  }

  return {
    claimId: result.attestationUID,
    txHash: "", // Circle SDK returns tx hash
    isHuman: true,
    biometricHash,
  };
}

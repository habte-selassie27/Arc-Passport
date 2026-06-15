import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { executeContractCall } from "./circleService.js";

export async function issueAttestation(
  subject: string,
  schemaId: string,
  dataCommitment: string,
  expiresAt: number
): Promise<`0x${string}`> {
  const walletId = process.env.CIRCLE_ISSUER_WALLET_ID;
  if (!walletId) throw new Error("CIRCLE_ISSUER_WALLET_ID not configured");
  if (!ADDRESSES.attestationRegistry) throw new Error("ATTESTATION_REGISTRY_ADDRESS not configured");

  const txHash = await executeContractCall(
    walletId,
    ADDRESSES.attestationRegistry,
    "attest(address,bytes32,bytes32,uint256)",
    [subject, schemaId, dataCommitment, expiresAt.toString()]
  );

  return txHash as `0x${string}`;
}

export async function revokeClaim(claimId: string): Promise<`0x${string}`> {
  const walletId = process.env.CIRCLE_ISSUER_WALLET_ID;
  if (!walletId) throw new Error("CIRCLE_ISSUER_WALLET_ID not configured");
  if (!ADDRESSES.attestationRegistry) throw new Error("ATTESTATION_REGISTRY_ADDRESS not configured");

  const txHash = await executeContractCall(
    walletId,
    ADDRESSES.attestationRegistry,
    "revoke(bytes32)",
    [claimId]
  );

  return txHash as `0x${string}`;
}

export async function getClaim(claimId: `0x${string}`) {
  if (!ADDRESSES.attestationRegistry) throw new Error("ATTESTATION_REGISTRY_ADDRESS not configured");

  return publicClient.readContract({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_REGISTRY_ABI,
    functionName: "getClaim",
    args: [claimId],
  });
}

export async function isValidClaim(claimId: `0x${string}`): Promise<boolean> {
  if (!ADDRESSES.attestationRegistry) throw new Error("ATTESTATION_REGISTRY_ADDRESS not configured");

  return publicClient.readContract({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_REGISTRY_ABI,
    functionName: "isValid",
    args: [claimId],
  }) as Promise<boolean>;
}

export async function getActiveClaim(
  subject: `0x${string}`,
  schemaId: `0x${string}`,
  issuer: `0x${string}`
): Promise<`0x${string}`> {
  if (!ADDRESSES.attestationRegistry) throw new Error("ATTESTATION_REGISTRY_ADDRESS not configured");

  return publicClient.readContract({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_REGISTRY_ABI,
    functionName: "getActiveClaim",
    args: [subject, schemaId, issuer],
  }) as Promise<`0x${string}`>;
}

import { MEMO_ABI } from "../abis/Memo.js";

export async function recordAttestationMemo(
  subject: string,
  complianceRef: string
): Promise<`0x${string}`> {
  const walletId = process.env.CIRCLE_ISSUER_WALLET_ID;
  if (!walletId) throw new Error("CIRCLE_ISSUER_WALLET_ID not configured");
  if (!ADDRESSES.memoContract) throw new Error("MEMO_CONTRACT_ADDRESS not configured");

  const memoBytes = `0x${Buffer.from(complianceRef, "utf-8").toString("hex")}` as `0x${string}`;

  const txHash = await executeContractCall(
    walletId,
    ADDRESSES.memoContract,
    "sendWithMemo(address,uint256,bytes)",
    [subject, "1", memoBytes]
  );

  return txHash as `0x${string}`;
}

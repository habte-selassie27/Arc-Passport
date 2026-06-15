import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { REPUTATION_REGISTRY_ABI } from "../abis/ReputationRegistry.js";
import { executeContractCall } from "./circleService.js";

export async function getReputationEvents(
  identityTokenId: number
): Promise<bigint[]> {
  return publicClient.readContract({
    address: ADDRESSES.reputationRegistry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "getEvents",
    args: [BigInt(identityTokenId)],
  }) as Promise<bigint[]>;
}

export async function recordReputationEvent(
  identityTokenId: number,
  eventType: string,
  metadataURI: string
): Promise<`0x${string}`> {
  const walletId = process.env.CIRCLE_ISSUER_WALLET_ID;
  if (!walletId) throw new Error("CIRCLE_ISSUER_WALLET_ID not configured");
  if (!ADDRESSES.reputationRegistry) throw new Error("REPUTATION_REGISTRY_ADDRESS not configured");

  const txHash = await executeContractCall(
    walletId,
    ADDRESSES.reputationRegistry,
    "recordEvent(uint256,string,string)",
    [identityTokenId.toString(), eventType, metadataURI]
  );

  return txHash as `0x${string}`;
}

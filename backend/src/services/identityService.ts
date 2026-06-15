import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { IDENTITY_REGISTRY_ABI } from "../abis/IdentityRegistry.js";

export async function getIdentity(address: `0x${string}`) {
  try {
    const result = await publicClient.readContract({
      address: ADDRESSES.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "getIdentity",
      args: [address],
    });
    const [tokenId, metadataUri] = result as [bigint, string];
    return { tokenId: Number(tokenId), metadataUri };
  } catch {
    return null;
  }
}

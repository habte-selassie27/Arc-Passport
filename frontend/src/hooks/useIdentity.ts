import { useQuery } from "@tanstack/react-query";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ADDRESSES } from "../config/addresses";
import { apiUrl } from "../config/api";

export function useIdentity(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["identity", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(apiUrl(`/identity/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to fetch identity");
      return json.data as { tokenId: number; metadataUri: string };
    },
    enabled: !!address,
  });
}

const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export function useIdentityRegister() {
  const { writeContract, data: hash, isPending, error } = useWriteContract({
    mutation: {
      onError: (err) => console.error("[identity register error]", err),
    },
  });
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return {
    writeContract: (args: { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }) =>
      writeContract({
        address: args.address,
        abi: args.abi as typeof IDENTITY_REGISTRY_ABI,
        functionName: args.functionName as "register",
        args: args.args as [string],
      }),
    data: hash,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

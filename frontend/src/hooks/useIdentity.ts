import { useQuery } from "@tanstack/react-query";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { apiUrl } from "../config/api";
import { IDENTITY_REGISTRY_ABI } from "../abis/identityRegistry";

export function useIdentity(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["identity", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(apiUrl(`/identity/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to fetch identity");
      return json.data as { address: string; registered: boolean; balance: number };
    },
    enabled: !!address,
  });
}

export interface IdentityRegistration {
  tokenId: number;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  status: "active" | "burned" | "transferred";
  metadataUri: string | null;
}

export interface IdentityHistoryData {
  address: string;
  balance: number;
  identity: { tokenId: number; metadataUri: string | null } | null;
  registrations: IdentityRegistration[];
  partialScan: boolean;
  olderTokensOutsideWindow: boolean;
}

export function useIdentityHistory(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["identity-history", address],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/identity/${address}/history`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to fetch registration history");
      return json.data as IdentityHistoryData;
    },
    enabled: !!address,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useIdentityRegister() {
  const { writeContract, data: hash, isPending: isSigning, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return {
    writeContract: (args: { address: `0x${string}`; functionName: string; args: readonly unknown[] }) =>
      writeContract({
        address: args.address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: args.functionName as "register",
        args: args.args as [string],
      }),
    hash,
    isSigning,
    isConfirming,
    isSuccess,
    isPending: isSigning || isConfirming,
    error,
  };
}

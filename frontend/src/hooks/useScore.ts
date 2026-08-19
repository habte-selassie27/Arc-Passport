import { useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ADDRESSES } from "../config/addresses";
import { SCORE_REGISTRY_ABI } from "../abis/ScoreRegistry";
import { apiUrl } from "../config/api";
import type { OnChainScore } from "../types/passport";

/**
 * Read the on-chain humanity score for an address.
 * Uses PassportVerifier.getScore (0 = global scorer) when configured,
 * falls back to direct ScoreRegistry read.
 */
export function useOnChainScore(address: `0x${string}` | undefined) {
  // Try via PassportVerifier first (has score support check built-in)
  const verifierRead = useReadContract({
    address: ADDRESSES.passportVerifier,
    abi: [
      {
        type: "function",
        name: "hasScoreSupport",
        inputs: [],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
      },
      {
        type: "function",
        name: "getScore",
        inputs: [
          { name: "subject", type: "address" },
          { name: "scorerId", type: "uint16" },
        ],
        outputs: [
          { name: "score", type: "uint16" },
          { name: "isValid", type: "bool" },
          { name: "isHuman", type: "bool" },
        ],
        stateMutability: "view",
      },
    ] as const,
    functionName: "getScore",
    args: address ? [address, 0] : undefined,
    query: {
      enabled: !!address && !!ADDRESSES.passportVerifier && !!ADDRESSES.scoreRegistry,
    },
  });

  // Direct ScoreRegistry read as fallback
  const directRead = useReadContract({
    address: ADDRESSES.scoreRegistry,
    abi: SCORE_REGISTRY_ABI,
    functionName: "getScore",
    args: address ? [address, 0] : undefined,
    query: {
      enabled: !!address && !!ADDRESSES.scoreRegistry && !verifierRead.data,
    },
  });

  const data = verifierRead.data ?? directRead.data;
  const isLoading = verifierRead.isLoading || directRead.isLoading;

  if (!data) {
    return { score: null, isLoading };
  }

  const [score, isValid, isHuman] = data;

  return {
    score: {
      score: Number(score),
      isValid,
      isHuman,
    } as OnChainScore,
    isLoading,
  };
}

/**
 * Check if a specific address is human (passes humanity threshold).
 */
export function useIsHuman(address: `0x${string}` | undefined) {
  return useReadContract({
    address: ADDRESSES.scoreRegistry,
    abi: SCORE_REGISTRY_ABI,
    functionName: "isHuman",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!ADDRESSES.scoreRegistry,
    },
  });
}

/**
 * Fetch the global humanity threshold.
 */
export function useHumanityThreshold() {
  return useReadContract({
    address: ADDRESSES.scoreRegistry,
    abi: SCORE_REGISTRY_ABI,
    functionName: "humanityThreshold",
    query: {
      enabled: !!ADDRESSES.scoreRegistry,
    },
  });
}

/**
 * Fetch score data from the backend API (includes raw detail with computedAt/expiresAt).
 */
export function useScoreApi(address: `0x${string}` | undefined, scorerId: number = 0) {
  return useQuery({
    queryKey: ["score", address, scorerId],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(apiUrl(`/score/${address}?scorerId=${scorerId}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to fetch score");
      return json.data as {
        score: number;
        isValid: boolean;
        isHuman: boolean;
        detail: {
          score: number;
          dataCommitment: string;
          computedAt: number;
          expiresAt: number;
          exists: boolean;
        };
      };
    },
    enabled: !!address,
  });
}

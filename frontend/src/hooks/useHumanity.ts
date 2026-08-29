/**
 * useHumanity.ts
 *
 * Hooks for querying humanity verification status from the HumanityOracle.
 * Uses the backend /liveness/status/:address endpoint which checks both
 * the oracle contract and legacy liveness records.
 */
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../config/api";

export interface HumanityStatus {
  /** Whether the wallet is controlled by a verified unique human. */
  isHuman: boolean;
  /** Verification mechanism used ("humanity-oracle" or "liveness-web"). */
  mechanism?: string;
  /** Source of the status ("oracle" or "legacy"). */
  source?: "oracle" | "legacy";
  /** Whether the attestation is valid on-chain. */
  onChain: boolean;
  /** The attestation claim ID (if exists). */
  claimId?: string;
  /** When the verification was performed. */
  checkedAt?: number;
  /** When the attestation expires (if applicable). */
  expiresAt?: number;
}

/**
 * Check if an address is a verified unique human.
 * Queries the HumanityOracle via the backend status endpoint.
 */
export function useHumanityStatus(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["humanity-status", address],
    queryFn: async (): Promise<HumanityStatus> => {
      if (!address) return { isHuman: false, onChain: false };
      const res = await fetch(apiUrl(`/liveness/status/${address}`));
      const json = await res.json();
      if (!json.success) {
        return { isHuman: false, onChain: false };
      }
      const data = json.data;
      return {
        isHuman: data.verified ?? false,
        mechanism: data.mechanism,
        source: data.source,
        onChain: data.onChain ?? false,
        claimId: data.claimId,
        checkedAt: data.checkedAt,
        expiresAt: data.expiresAt,
      };
    },
    enabled: !!address,
    staleTime: 30_000, // 30s — don't re-query too frequently
    refetchOnWindowFocus: true, // re-check when user comes back
  });
}

/**
 * useScorerPasses — Lightweight boolean pass/fail for access-gating checks.
 *
 * Polls GET /score/:address/passes/:scorerId every 30 seconds.
 * Used by ScorerPassesGate and partner dApps.
 */

import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../config/api";

interface ScorerPassesResult {
  subject: string;
  scorerId: number;
  passes: boolean;
  score: number;
  threshold: number;
  computedAt: number;
}

export function useScorerPasses(
  address: `0x${string}` | undefined,
  scorerId: number = 0,
) {
  return useQuery<ScorerPassesResult>({
    queryKey: ["scorerPasses", address, scorerId],
    queryFn: async () => {
      if (!address) throw new Error("No address");
      const res = await fetch(apiUrl(`/score/${address}/passes/${scorerId}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to check scorer");
      return json.data;
    },
    enabled: !!address,
    refetchInterval: 30_000, // Poll every 30s for live gating
    staleTime: 15_000,
  });
}

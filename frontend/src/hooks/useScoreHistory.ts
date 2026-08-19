/**
 * useScoreHistory — Fetches historical score snapshots for an address.
 *
 * Calls GET /score/:address/history from the backend.
 */

import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../config/api";

export interface ScoreHistoryEntry {
  subject:   string;
  scorerId:  number;
  score:     number;
  computedAt: number;
  expiresAt:  number;
  source:    "api" | "chain";
}

export function useScoreHistory(
  address: `0x${string}` | undefined,
  options?: { limit?: number; scorerId?: number },
) {
  return useQuery<ScoreHistoryEntry[]>({
    queryKey: ["scoreHistory", address, options?.limit, options?.scorerId],
    queryFn: async () => {
      if (!address) return [];
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      if (options?.scorerId !== undefined) params.set("scorerId", String(options.scorerId));
      const qs = params.toString();
      const res = await fetch(apiUrl(`/score/${address}/history${qs ? `?${qs}` : ""}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to fetch history");
      return json.data as ScoreHistoryEntry[];
    },
    enabled: !!address,
    staleTime: 60_000,
  });
}

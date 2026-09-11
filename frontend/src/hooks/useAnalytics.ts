import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../config/api";

interface EventAnalytics {
  lastMinute: number;
  lastHour: number;
  total: number;
}

export interface AnalyticsData {
  events: Record<string, EventAnalytics>;
  generatedAt: number;
}

export function useAnalytics() {
  return useQuery<AnalyticsData | null>({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/v1/analytics"));
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

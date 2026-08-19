import { useQuery } from "@tanstack/react-query";

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
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001"}/v1/analytics`
      );
      const json = await res.json();
      return json.success ? json.data : null;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

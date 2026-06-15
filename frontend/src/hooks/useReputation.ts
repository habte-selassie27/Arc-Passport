import { useQuery } from "@tanstack/react-query";
import { ADDRESSES } from "../config/addresses";
import { apiUrl } from "../config/api";

export function useReputation(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["reputation", address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(apiUrl(`/reputation/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to fetch reputation");
      return json.data.events as number[];
    },
    enabled: !!address,
  });
}

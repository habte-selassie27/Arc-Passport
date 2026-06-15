import { useQuery } from "@tanstack/react-query";
import type { PassportDocument } from "../types/passport";
import { apiUrl } from "../config/api";

export function usePassport(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["passport", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(apiUrl(`/passport/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to fetch passport");
      return json.data as PassportDocument;
    },
    enabled: !!address,
  });
}

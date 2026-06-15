import { useQuery } from "@tanstack/react-query";
import { useAttestWrite, useRevokeWrite, useValidateClaim } from "./useArcContract";
import { apiUrl } from "../config/api";

export { useAttestWrite, useRevokeWrite, useValidateClaim };

export function useClaim(claimId: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["claim", claimId],
    queryFn: async () => {
      if (!claimId) return null;
      const res = await fetch(apiUrl(`/attestation/claim/${claimId}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to fetch claim");
      return json.data;
    },
    enabled: !!claimId,
  });
}

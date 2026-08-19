import { useState, useCallback } from "react";
import { signedFetch } from "../utils/signedApi";

export interface ClaimFieldClassification {
  name: string;
  type: string;
  classification: "PUBLIC" | "PRIVATE" | "DERIVED";
}

export interface FieldProof {
  claimId: string;
  leaf: string;
  proof: string[];
  leafIndex: number;
  field: ClaimFieldClassification & { value: unknown };
}

export function useFieldProof() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFields = useCallback(
    async (
      claimId: string,
      address: `0x${string}`,
      signMessage: (args: { message: string }) => Promise<`0x${string}`>
    ): Promise<ClaimFieldClassification[]> => {
      setLoading(true);
      setError(null);
      try {
        const data = await signedFetch<{
          fields: ClaimFieldClassification[];
          legacy?: boolean;
        }>({
          path: `/attestation/claim/${claimId}/fields`,
          address,
          signMessage,
        });
        return data.fields ?? [];
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch fields";
        setError(msg);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchProof = useCallback(
    async (
      claimId: string,
      fieldName: string,
      address: `0x${string}`,
      signMessage: (args: { message: string }) => Promise<`0x${string}`>
    ): Promise<FieldProof | null> => {
      setLoading(true);
      setError(null);
      try {
        return await signedFetch<FieldProof>({
          path: `/attestation/claim/${claimId}/field/${fieldName}/proof`,
          address,
          signMessage,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to generate proof";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { fetchFields, fetchProof, loading, error };
}

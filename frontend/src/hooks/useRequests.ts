import { useCallback, useState } from "react";
import { useSignMessage } from "wagmi";
import { signedFetch } from "../utils/signedApi";
import { apiUrl } from "../config/api";

export type RequestStatus = "pending" | "approved" | "rejected";

export interface AttestationRequest {
  id:         string;
  subject:    string;
  issuer:     string;
  schemaId:   string;
  schemaName: string;
  note:       string;
  status:     RequestStatus;
  createdAt:  number;
  decidedAt?: number;
}

export interface SchemaOption {
  id:      string;
  name:    string;
  service: string;
}

/** Public catalog of credential types (GET /v1/requests/schemas). */
export async function fetchSchemaCatalog(): Promise<SchemaOption[]> {
  try {
    const res = await fetch(apiUrl("/v1/requests/schemas"));
    if (!res.ok) return [];
    const json = await res.json();
    return json.success ? (json.data.schemas as SchemaOption[]) : [];
  } catch {
    return [];
  }
}

export function useRequests(address: `0x${string}` | undefined) {
  const { signMessageAsync } = useSignMessage();
  const [requests, setRequests] = useState<AttestationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (role: "subject" | "issuer" = "subject") => {
      if (!address) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await signedFetch<{ requests: AttestationRequest[] }>({
          path: `/v1/requests?role=${role}`,
          address,
          signMessage: signMessageAsync,
        });
        setRequests(data.requests);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [address, signMessageAsync]
  );

  const create = useCallback(
    async (input: { issuer: string; schemaId: string; note?: string }) => {
      if (!address) throw new Error("Wallet not connected");
      try {
        await signedFetch({
          path: "/v1/requests",
          address,
          signMessage: signMessageAsync,
          method: "POST",
          body: input,
        });
        await load("subject");
        return true;
      } catch (err: unknown) {
        setError((err as Error).message);
        return false;
      }
    },
    [address, signMessageAsync, load]
  );

  const decide = useCallback(
    async (id: string, decision: "approved" | "rejected") => {
      if (!address) return false;
      try {
        await signedFetch({
          path: `/v1/requests/${id}/${decision}`,
          address,
          signMessage: signMessageAsync,
          method: "POST",
        });
        await load("issuer");
        return true;
      } catch (err: unknown) {
        setError((err as Error).message);
        return false;
      }
    },
    [address, signMessageAsync, load]
  );

  return { requests, isLoading, error, load, create, decide };
}

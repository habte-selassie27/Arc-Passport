import { useState, useEffect } from "react";
import { apiUrl } from "../config/api";

export interface OnChainIssuer {
  address: `0x${string}`;
  credentialTypes: string[];
}

export function useIssuers() {
  const [issuers, setIssuers] = useState<OnChainIssuer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchIssuers() {
      try {
        const res = await fetch(apiUrl("/attestation/issuers"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setIssuers(json.data.issuers);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchIssuers();
    return () => { cancelled = true; };
  }, []);

  return { issuers, loading, error };
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { apiUrl } from "../config/api";
import { signedFetch } from "../utils/signedApi";

export interface WorldIdStatus {
  subject: string;
  verified: boolean;
  onChain: boolean;
  state: "initialized" | "verified" | "attesting" | "complete" | "failed" | "expired" | null;
  claimId?: string;
  mechanism?: string;
  checkedAt?: number;
  expiresAt?: number;
}

export interface WorldIdConfig {
  mechanism: string;
  description: string;
  schemaId?: string;
  schemaName?: string;
  gateAddress?: string | null;
  scoreWeight: number;
}

export interface RpSignature {
  sig: string;
  nonce: string;
  created_at: string;
  expires_at: string;
}

export interface VerifyResult {
  claimId?: string;
  txHash?: string;
  nullifier: string;
}

/** Public, read-only status of a wallet's humanity proof. */
export function useWorldIdStatus(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["world-id-status", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(apiUrl(`/world-id/status/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load status");
      return json.data as WorldIdStatus;
    },
    enabled: !!address,
  });
}

/** Public config describing the humanity verification mechanism. */
export function useWorldIdConfig() {
  return useQuery({
    queryKey: ["world-id-config"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/world-id/config"));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load config");
      return json.data as WorldIdConfig;
    },
  });
}

/**
 * Orchestrates the full World ID verification flow for the connected wallet:
 * fetch RP signature, submit proof after IDKit completes, and return the result.
 */
export function useWorldIdFlow() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const getRpSignature = useMutation({
    mutationFn: async (action: string) => {
      if (!address) throw new Error("Connect a wallet first");
      return signedFetch<RpSignature>({
        path: "/world-id/rp-signature",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: { action },
      });
    },
  });

  const verify = useMutation({
    mutationFn: async (args: { rpId: string; idkitResponse: any }) => {
      if (!address) throw new Error("Connect a wallet first");
      return signedFetch<VerifyResult>({
        path: "/world-id/verify",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: args,
      });
    },
  });

  return { address, getRpSignature, verify };
}

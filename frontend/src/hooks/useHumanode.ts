import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { apiUrl } from "../config/api";
import { signedFetch } from "../utils/signedApi";

export type HumanodeState =
  | "initialized"
  | "verified"
  | "attesting"
  | "complete"
  | "failed"
  | "expired";

export interface HumanityVerification {
  verificationId: string;
  subject: string;
  state: HumanodeState;
  humanodeAccountId?: string;
  nullifier?: string;
  mechanism?: string;
  claimId?: string;
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface HumanityStatus {
  subject: string;
  verified: boolean;
  onChain: boolean;
  state: HumanodeState | null;
  claimId?: string;
  mechanism?: string;
  checkedAt?: number;
  expiresAt?: number;
}

export interface StartResult {
  verificationId: string;
  authorizeUrl: string;
  state: string;
  expiresAt: number;
}

export interface HumanodeConfig {
  mechanism: string;
  description: string;
  schemaId?: string;
  schemaName?: string;
  gateAddress?: string | null;
  scoreWeight: number;
}

/** Public, read-only status of a wallet's humanity proof. */
export function useHumanityStatus(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["humanity-status", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(apiUrl(`/human-node/verify/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load humanity status");
      return json.data as HumanityStatus;
    },
    enabled: !!address,
  });
}

/** Public config describing the humanity verification mechanism. */
export function useHumanodeConfig() {
  return useQuery({
    queryKey: ["humanode-config"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/human-node/config"));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load config");
      return json.data as HumanodeConfig;
    },
  });
}

/**
 * Orchestrates the full "Verify Humanity" flow for the connected wallet:
 * start a session, open Humanode, complete the OAuth callback, and poll until
 * the on-chain attestation is issued.
 */
export function useHumanodeFlow() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const start = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect a wallet first");
      return signedFetch<StartResult>({
        path: "/human-node/start",
        address,
        signMessage: signMessageAsync,
        method: "POST",
      });
    },
  });

  const poll = async (verificationId: string): Promise<HumanityVerification> => {
    if (!address) throw new Error("Connect a wallet first");
    return signedFetch<HumanityVerification>({
      path: `/human-node/status/${verificationId}`,
      address,
      signMessage: signMessageAsync,
    });
  };

  const complete = useMutation({
    mutationFn: async (args: { code: string; state: string; verificationId: string }) => {
      if (!address) throw new Error("Connect a wallet first");
      return signedFetch<HumanityVerification>({
        path: "/human-node/callback",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: args,
      });
    },
  });

  return { address, start, poll, complete };
}

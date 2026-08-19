import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { apiUrl } from "../config/api";
import { signedFetch } from "../utils/signedApi";

// ── Types ──

export type Web2ProofState = "initialized" | "pending" | "verified" | "attesting" | "complete" | "failed" | "expired";

export interface Web2ProofVerification {
  verificationId: string;
  subject: string;
  state: Web2ProofState;
  templateId: string;
  taskId?: string;
  provider?: string;
  dataHash?: string;
  claimId?: string;
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface Web2ProofStatus {
  subject: string;
  verified: boolean;
  provider?: string;
  checkedAt?: number;
  expiresAt?: number;
  isHolder: boolean;
}

export interface Web2ProofConfig {
  provider: string;
  mechanism: string;
  schemaId: string;
  templates: { id: string; name: string; description: string }[];
}

export interface StartResult {
  verificationId: string;
  authUrl: string;
}

// ── Public hooks (no auth) ──

export function useWeb2ProofStatus(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["web2-proof-status", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(apiUrl(`/web2-proof/verify/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load status");
      return json.data as Web2ProofStatus;
    },
    enabled: !!address,
  });
}

export function useWeb2ProofConfig() {
  return useQuery({
    queryKey: ["web2-proof-config"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/web2-proof/config"));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load config");
      return json.data as Web2ProofConfig;
    },
  });
}

// ── Authenticated flow hooks ──

export function useWeb2ProofFlow() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const start = useMutation({
    mutationFn: async (templateId: string) => {
      if (!address) throw new Error("Connect a wallet first");
      return signedFetch<StartResult>({
        path: "/web2-proof/start",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: { templateId },
      });
    },
  });

  const poll = async (verificationId: string): Promise<Web2ProofVerification> => {
    if (!address) throw new Error("Connect a wallet first");
    return signedFetch<Web2ProofVerification>({
      path: `/web2-proof/status/${verificationId}`,
      address,
      signMessage: signMessageAsync,
    });
  };

  const complete = useMutation({
    mutationFn: async (args: { taskId: string; verificationId: string }) => {
      if (!address) throw new Error("Connect a wallet first");
      return signedFetch<Web2ProofVerification>({
        path: "/web2-proof/callback",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: args,
      });
    },
  });

  return { address, start, poll, complete };
}

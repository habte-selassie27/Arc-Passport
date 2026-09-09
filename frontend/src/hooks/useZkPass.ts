import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { apiUrl } from "../config/api";
import { signedFetch } from "../utils/signedApi";

// ── zkPass Types ──

export type Web2ProofState = "initialized" | "pending" | "verified" | "attesting" | "complete" | "failed" | "expired";

export interface ZkPassProofResult {
  allocatorAddress: string;
  allocatorSignature: string;
  publicFields: Record<string, string>;
  publicFieldsHash: string;
  taskId: string;
  uHash: string;
  validatorAddress: string;
  validatorSignature: string;
  recipient?: string;
}

export interface Web2ProofVerification {
  verificationId: string;
  subject: string;
  state: Web2ProofState;
  schemaId: string;
  taskId?: string;
  nullifier?: string;
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
  templates: { id: string; name: string; description: string; zkpassSchemaId: string }[];
}

export interface StartResult {
  verificationId: string;
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

export function useZkPassFlow() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isExtensionAvailable, setIsExtensionAvailable] = useState<boolean | null>(null);

  const start = useMutation({
    mutationFn: async (schemaId: string) => {
      if (!address) throw new Error("Connect a wallet first");
      return signedFetch<StartResult>({
        path: "/web2-proof/start",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: { schemaId },
      });
    },
  });

  const submitProof = useMutation({
    mutationFn: async (args: { verificationId: string; proof: ZkPassProofResult }) => {
      if (!address) throw new Error("Connect a wallet first");
      return signedFetch<Web2ProofVerification>({
        path: "/web2-proof/proof",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: args,
      });
    },
  });

  const checkExtension = useCallback(async () => {
    try {
      const TransgateConnect = (await import("@zkpass/transgate-js-sdk")).default;
      const appId = import.meta.env.VITE_ZKPASS_APP_ID || "";
      const connector = new TransgateConnect(appId);
      const available = await connector.isTransgateAvailable();
      setIsExtensionAvailable(available);
      return available;
    } catch {
      setIsExtensionAvailable(false);
      return false;
    }
  }, []);

  const launchVerification = useCallback(async (zkpassSchemaId: string): Promise<ZkPassProofResult> => {
    const TransgateConnect = (await import("@zkpass/transgate-js-sdk")).default;
    const appId = import.meta.env.VITE_ZKPASS_APP_ID || "";
    const connector = new TransgateConnect(appId);

    const available = await connector.isTransgateAvailable();
    if (!available) {
      throw new Error("Please install the TransGate extension from Chrome Web Store");
    }

    const res = await connector.launch(zkpassSchemaId, address);
    return res as ZkPassProofResult;
  }, [address]);

  return {
    address,
    start,
    submitProof,
    checkExtension,
    launchVerification,
    isExtensionAvailable,
  };
}

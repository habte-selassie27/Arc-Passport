/**
 * useZKProof.ts — Hook for ZK proof verification and submission.
 *
 * What it does: provides functions to list verifiers, submit proofs, check proof status.
 * What it does NOT do: generate ZK proofs (that happens on the user's device).
 * What calls it: ZKPassportFlow component, /zk page.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { apiUrl } from "../config/api";
import { signedFetch } from "../utils/signedApi";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ZKVerifierInfo {
  id: number;
  backend: string;
  name: string;
  addedAt: number;
  active: boolean;
}

export interface ZKStats {
  totalProofsVerified: number;
  activeVerifiers: number;
  totalVerifiers: number;
}

export interface ZKProofStatus {
  proofHash: string;
  used: boolean;
  message: string;
}

// ── Queries ───────────────────────────────────────────────────────────────

/** Fetch all registered ZK verifier backends. */
export function useZKVerifiers() {
  return useQuery({
    queryKey: ["zk-verifiers"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/zk/verifiers"));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as { count: number; verifiers: ZKVerifierInfo[] };
    },
  });
}

/** Fetch ZK aggregate stats. */
export function useZKStats() {
  return useQuery({
    queryKey: ["zk-stats"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/zk/stats"));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as ZKStats;
    },
  });
}

/** Check if a proof hash has been used (replay protection). */
export function useZKProofStatus(proofHash: string | undefined) {
  return useQuery({
    queryKey: ["zk-proof-status", proofHash],
    queryFn: async () => {
      if (!proofHash) return null;
      const res = await fetch(apiUrl(`/zk/proof/${proofHash}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as ZKProofStatus;
    },
    enabled: !!proofHash,
  });
}

/** Fetch trusted document types. */
export function useZKDocumentTypes() {
  return useQuery({
    queryKey: ["zk-document-types"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/zk/document-types"));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as Record<string, boolean>;
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

/** Submit a passport authenticity proof (Layer 1). */
export function useSubmitPassportProof() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  return useMutation({
    mutationFn: async (params: {
      verifierId: number;
      proof: string;
      publicInputs: string[];
      proofHash: string;
      documentType: string;
      issuedAt?: number;
      expiresAt?: number;
    }) => {
      if (!address) throw new Error("Wallet not connected");
      const json = await signedFetch<Record<string, unknown>>({
        path: "/zk/submit",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: params,
      });
      if (!json.success) throw new Error((json.error as any)?.message ?? "Submit failed");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zk-stats"] });
    },
  });
}

/** Submit an attribute proof (Layer 2). */
export function useSubmitAttributeProof() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  return useMutation({
    mutationFn: async (params: {
      verifierId: number;
      proof: string;
      publicInputs: string[];
      proofHash: string;
      attributeHash: string;
      expiresAt?: number;
    }) => {
      if (!address) throw new Error("Wallet not connected");
      const json = await signedFetch<Record<string, unknown>>({
        path: "/zk/submit/attribute",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: params,
      });
      if (!json.success) throw new Error((json.error as any)?.message ?? "Submit failed");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zk-stats"] });
    },
  });
}

/** Dry-run verify a ZK proof (no attestation issued). */
export function useVerifyZKProof() {
  return useMutation({
    mutationFn: async (params: {
      verifierId: number;
      proof: string;
      publicInputs: string[];
      subject: string;
      proofHash: string;
    }) => {
      const res = await fetch(apiUrl("/zk/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data;
    },
  });
}

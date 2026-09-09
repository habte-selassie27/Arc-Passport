/**
 * useZkVault.ts — Encrypted ID Vault hook.
 *
 * What it does: orchestrates the client-side vault flow:
 *   1. OCR the document photo (mrzOcr) → extract fields locally
 *   2. Derive a wallet-key (vaultCrypto) → AES-GCM encrypt the fields
 *   3. Pin ONLY the encrypted blob to IPFS (via /upload/json)
 *   4. Commit the {cid, fieldsHash} on-chain via /zk/vault/commit (signed)
 *   5. Status + decrypt: fetch the CID, decrypt locally with the re-derived key
 * What it does NOT do: ever transmit unencrypted fields.
 * What calls it: ZKPassport page Vault tab.
 */

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { apiUrl } from "../config/api";
import { signedFetch } from "../utils/signedApi";
import {
  deriveVaultKey,
  encryptVaultPayload,
  decryptVaultPayload,
  computeFieldsHash,
  type EncryptedVault,
  type VaultPayload,
} from "../utils/vaultCrypto";
import { extractMrzFromImage, type MrzResult } from "../utils/mrzOcr";

// ── Types ─────────────────────────────────────────────────────────────────

export interface VaultCommitResult {
  subject: string;
  vaultCid: string;
  documentType: string;
  committedAt: number;
  expiresAt: number;
  claimId?: string;
  txHash?: string;
}

export interface VaultStatus {
  committed: boolean;
  isValid: boolean;
  documentType?: string;
  vaultCid?: string;
  fieldsHash?: string;
  committedAt?: number;
  expiresAt?: number;
  claimId?: string;
  txHash?: string;
}

export type VaultPhase =
  | "idle"
  | "ocr"
  | "key"
  | "encrypting"
  | "uploading"
  | "committing"
  | "done"
  | "error";

// ── Hook ──────────────────────────────────────────────────────────────────

export function useZkVault() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [phase, setPhase] = useState<VaultPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mrz, setMrz] = useState<MrzResult | null>(null);
  const [commitResult, setCommitResult] = useState<VaultCommitResult | null>(null);
  const [decrypted, setDecrypted] = useState<VaultPayload | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setProgress(0);
    setError(null);
    setMrz(null);
    setCommitResult(null);
    setDecrypted(null);
  }, []);

  /**
   * Full flow: file → OCR → encrypt → IPFS → on-chain commitment.
   * `manualFields` skips OCR (fallback when the MRZ can't be read).
   */
  const commitVault = useCallback(
    async (file: File, manualFields?: Record<string, string>) => {
      if (!address) throw new Error("Wallet not connected");
      setError(null);
      setDecrypted(null);

      try {
        // 1. Extract fields (OCR or manual)
        let fields: Record<string, string>;
        let checks: { name: string; valid: boolean }[] = [];
        if (manualFields) {
          fields = manualFields;
          setMrz(null);
        } else {
          setPhase("ocr");
          setProgress(0);
          const result = await extractMrzFromImage(file, setProgress);
          setMrz(result);
          fields = result.fields;
          checks = result.checks;
        }
        if (!fields.documentNumber) {
          throw new Error("Document number missing from extracted fields");
        }

        // 2. Derive key from wallet signature
        setPhase("key");
        const key = await deriveVaultKey(address, signMessageAsync);

        // 3. Encrypt
        setPhase("encrypting");
        const payload: VaultPayload = {
          v: 1,
          docType: fields.documentType || "document",
          fields,
          createdAt: Math.floor(Date.now() / 1000),
        };
        const blob: EncryptedVault = await encryptVaultPayload(key, payload);

        // 4. Pin only the encrypted blob
        setPhase("uploading");
        const ipfsUri = await uploadJsonToIpfs(blob, `arcpass-vault-${address.slice(0, 10)}`);
        if (!ipfsUri) throw new Error("IPFS upload failed — check backend Pinata config");

        // 5. On-chain commitment (signed)
        setPhase("committing");
        const fieldsHash = computeFieldsHash(fields);
        const result = await signedFetch<VaultCommitResult>({
          path: "/zk/vault/commit",
          address,
          signMessage: signMessageAsync,
          method: "POST",
          body: { vaultCid: ipfsUri, fieldsHash, documentType: payload.docType },
        });
        setCommitResult(result);
        setPhase("done");
        return { result, mrz: mrz, checks };
      } catch (err) {
        setPhase("error");
        setError((err as Error).message);
        throw err;
      }
    },
    [address, signMessageAsync, mrz]
  );

  /** Fetch on-chain commitment status for the connected wallet. */
  const refreshStatus = useCallback(async () => {
    if (!address) return null;
    return signedFetch<VaultStatus>({
      path: "/zk/vault/status",
      address,
      signMessage: signMessageAsync,
    });
  }, [address, signMessageAsync]);

  /** Fetch the encrypted blob and decrypt locally (re-derives the key). */
  const decryptVault = useCallback(
    async (vaultCid: string): Promise<VaultPayload> => {
      if (!address) throw new Error("Wallet not connected");
      setError(null);
      try {
        setPhase("key");
        const key = await deriveVaultKey(address, signMessageAsync);

        const cid = vaultCid.replace("ipfs://", "");
        const res = await fetch(
          `https://gateway.pinata.cloud/ipfs/${cid}`
        );
        if (!res.ok) throw new Error(`Failed to fetch vault from IPFS (${res.status})`);
        const blob = (await res.json()) as EncryptedVault;

        setPhase("encrypting");
        const payload = await decryptVaultPayload(key, blob);
        setDecrypted(payload);
        return payload;
      } catch (err) {
        setPhase("error");
        setError((err as Error).message);
        throw err;
      } finally {
        setPhase("idle");
      }
    },
    [address, signMessageAsync]
  );

  return {
    phase,
    progress,
    error,
    mrz,
    commitResult,
    decrypted,
    isBusy: phase !== "idle" && phase !== "done" && phase !== "error",
    reset,
    commitVault,
    refreshStatus,
    decryptVault,
  };
}

// ── Public badge query (any passport viewer, no signature) ─────────────────

export interface VaultBadge {
  committed: boolean;
  isValid: boolean;
  documentType?: string;
  committedAt?: number;
  expiresAt?: number;
}

/** Public vault-attestation badge data for any address (used on Passport pages). */
export function useVaultBadge(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["zk-vault-badge", address?.toLowerCase()],
    enabled: !!address,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/zk/vault/status/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as VaultBadge;
    },
    staleTime: 60_000,
  });
}

// ── IPFS helper (same pattern as RegisterForm) ────────────────────────────

async function uploadJsonToIpfs(
  data: EncryptedVault,
  name: string
): Promise<string | null> {
  const res = await fetch(apiUrl("/upload/json"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: data as unknown as Record<string, unknown>, name }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[upload/json]", res.status, text);
    return null;
  }
  const json = await res.json().catch(() => null);
  return json?.data?.ipfsUri ?? null;
}

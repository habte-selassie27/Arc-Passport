/**
 * vaultCrypto.ts — Client-side encryption for the ZK ID Vault.
 *
 * What it does: encrypts/decrypts extracted document fields with AES-256-GCM
 *   using a key derived from a wallet signature. Raw PII NEVER leaves the
 *   browser unencrypted — only the ciphertext blob is pinned to IPFS.
 * What it does NOT do: any networking.
 * What calls it: useZkVault hook.
 *
 * Key derivation:
 *   entropy = EIP-191 personal_sign("ArcPass ID Vault v1 key\nWallet: <addr>\nOnly for local encryption.")
 *   key     = PBKDF2(SHA-256(entropy), salt = keccak256(address), 150k iters) → 32 bytes
 *
 * The signature itself is never stored or sent — only its SHA-256 digest feeds
 * the KDF. The wallet can always re-derive the key by signing again.
 */

import { keccak256 } from "viem";

const KEY_MESSAGE = (address: string) =>
  `ArcPass ID Vault v1 key\nWallet: ${address.toLowerCase()}\nOnly for local encryption.`;

// ── Key derivation ────────────────────────────────────────────────────────

/** Sign once to derive the vault encryption key. Never persisted. */
export async function deriveVaultKey(
  address: `0x${string}`,
  signMessage: (args: { message: string }) => Promise<`0x${string}`>
): Promise<CryptoKey> {
  const signature = await signMessage({ message: KEY_MESSAGE(address) });
  const digest = await crypto.subtle.digest("SHA-256", utf8(signature));
  const salt = utf8(keccak256(utf8(address.toLowerCase())));

  const baseKey = await crypto.subtle.importKey("raw", digest, "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── Encrypt / decrypt ─────────────────────────────────────────────────────

export interface VaultPayload {
  v: 1;
  docType: string;
  fields: Record<string, string>;
  createdAt: number;
}

export interface EncryptedVault {
  ct: string; // base64 ciphertext
  iv: string; // base64 12-byte GCM IV
}

export async function encryptVaultPayload(
  key: CryptoKey,
  payload: VaultPayload
): Promise<EncryptedVault> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return {
    ct: bytesToBase64(new Uint8Array(ct)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptVaultPayload(
  key: CryptoKey,
  blob: EncryptedVault
): Promise<VaultPayload> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(blob.iv) },
    key,
    base64ToBytes(blob.ct)
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as VaultPayload;
}

// ── Fields hash (must match backend expectation: keccak256 of canonical JSON) ──

/** keccak256 of the deterministic JSON of the extracted fields. */
export function computeFieldsHash(fields: Record<string, string>): `0x${string}` {
  const canonical = JSON.stringify(fields, Object.keys(fields).sort());
  return keccak256(utf8(canonical));
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** UTF-8 encode into a plain ArrayBuffer-backed Uint8Array (WebCrypto-safe). */
function utf8(s: string): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(s);
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

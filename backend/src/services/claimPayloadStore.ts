/**
 * claimPayloadStore — lightweight JSON-file-backed store mapping
 * claimId → { ipfsCid, fields, createdAt }.
 *
 * When Pinata credentials are configured the full claim payload is pinned to IPFS
 * and the CID is stored here. When credentials are missing (dev/test) the payload
 * is kept only in this store so that the proof-generation endpoints still work.
 */

import fs from "node:fs";
import path from "node:path";

export interface ClaimFieldPayload {
  name: string;
  type: string;
  value: unknown;
  classification: string;
}

export interface ClaimPayloadRecord {
  claimId: string;
  ipfsCid: string | null;
  fields: ClaimFieldPayload[];
  leaves: string[];
  createdAt: number;
}

const STORE_PATH = path.resolve(
  process.cwd(),
  process.env.CLAIM_PAYLOAD_STORE ?? ".claim-payloads.json"
);

let store: Map<string, ClaimPayloadRecord> = new Map();
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const arr = JSON.parse(raw) as ClaimPayloadRecord[];
    for (const rec of arr) store.set(rec.claimId, rec);
  } catch {
    // File doesn't exist yet — that's fine
  }
}

function persist() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify([...store.values()], null, 2));
  } catch {
    // Best effort — log but don't throw
    console.warn("[claimPayloadStore] Failed to persist store to disk");
  }
}

export function saveClaimPayload(record: ClaimPayloadRecord): void {
  load();
  store.set(record.claimId, record);
  persist();
}

export function getClaimPayload(claimId: string): ClaimPayloadRecord | undefined {
  load();
  return store.get(claimId);
}

export function deleteClaimPayload(claimId: string): boolean {
  load();
  const existed = store.delete(claimId);
  if (existed) persist();
  return existed;
}

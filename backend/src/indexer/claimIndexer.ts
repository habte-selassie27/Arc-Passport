import { publicClient } from "../services/arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { processEvent } from "../monitoring/eventMonitor.js";
import { decodeEventLog } from "viem";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

interface ClaimIndex {
  claimId: string;
  subject: string;
  schemaId: string;
  issuer: string;
  blockNum: bigint;
  timestamp: bigint;
  revoked: boolean;
}

const claimIndex: Map<string, ClaimIndex> = new Map();

// Persist last indexed block and claim index to avoid full rescans on restart
const STATE_FILE = resolve(import.meta.dirname ?? ".", "../../.indexer-state.json");

interface PersistedState {
  lastIndexedBlock: string;
  claims: Array<{
    claimId: string;
    subject: string;
    schemaId: string;
    issuer: string;
    blockNum: string;
    timestamp: string;
    revoked: boolean;
  }>;
}

function loadPersistedState(): { lastIndexed: bigint; claims: ClaimIndex[] } {
  try {
    if (existsSync(STATE_FILE)) {
      const state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as PersistedState;
      const lastIndexed = state.lastIndexedBlock ? BigInt(state.lastIndexedBlock) : 0n;
      const claims = (state.claims ?? []).map((c) => ({
        ...c,
        blockNum: BigInt(c.blockNum),
        timestamp: BigInt(c.timestamp),
      }));
      return { lastIndexed, claims };
    }
  } catch { /* ignore */ }
  return { lastIndexed: 0n, claims: [] };
}

function savePersistedState(block: bigint) {
  try {
    const claims = Array.from(claimIndex.values()).map((c) => ({
      ...c,
      blockNum: c.blockNum.toString(),
      timestamp: c.timestamp.toString(),
    }));
    writeFileSync(STATE_FILE, JSON.stringify({
      lastIndexedBlock: block.toString(),
      claims,
    }));
  } catch { /* ignore */ }
}

let _catchUpDone = false;
let _catchUpPromise: Promise<void> | null = null;

/** Resolves when the initial catch-up scan has completed. */
export function waitForIndexerReady(): Promise<void> {
  if (_catchUpDone) return Promise.resolve();
  return _catchUpPromise ?? Promise.resolve();
}

export function isIndexerReady(): boolean {
  return _catchUpDone;
}

export async function startClaimIndexer() {
  if (!ADDRESSES.attestationRegistry) {
    console.warn("[indexer] AttestationRegistry not configured, skipping");
    return;
  }

  // Background catch-up: scan last 80k blocks. Routes serve stale data
  // until this completes, then the live watcher keeps the index current.
  _catchUpPromise = _catchUpScan()
    .then(() => { _catchUpDone = true; console.log("[indexer] Catch-up scan complete, indexer ready"); })
    .catch((err) => { console.error("[indexer] Catch-up scan failed:", (err as Error).message); _catchUpDone = true; });

  publicClient.watchContractEvent({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_REGISTRY_ABI,
    eventName: "ClaimIssued",
    onLogs: (logs) => {
      for (const log of logs) {
        const entry: ClaimIndex = {
          claimId: (log.args.claimId ?? "") as string,
          subject: (log.args.subject ?? "") as string,
          schemaId: (log.args.schemaId ?? "") as string,
          issuer: (log.args.issuer ?? "") as string,
          blockNum: log.blockNumber,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
          revoked: false,
        };
        claimIndex.set(entry.claimId, entry);

        processEvent({
          name: "ClaimIssued",
          args: log.args as Record<string, unknown>,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex ?? 0,
        });
      }
    },
  });

  // Listen for ClaimRevoked events and mark claims as revoked in the index.
  // Without this handler, revoked claims persist in-memory as valid until the
  // onchain isValid() spot-check in passportService catches them — a correctness
  // gap per AGENTS.md §4.4 and §15.2.6.
  publicClient.watchContractEvent({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_REGISTRY_ABI,
    eventName: "ClaimRevoked",
    onLogs: (logs) => {
      for (const log of logs) {
        const claimId = (log.args.claimId ?? "") as string;
        const existing = claimIndex.get(claimId);
        if (existing) {
          existing.revoked = true;
        }

        processEvent({
          name: "ClaimRevoked",
          args: log.args as Record<string, unknown>,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex ?? 0,
        });
      }
    },
  });

  console.log("[indexer] ClaimIndexer started");
}

async function _catchUpScan() {
  const latest = await publicClient.getBlockNumber();
  const chunkSize = 5000n;
  const { lastIndexed: lastIndexed, claims: persistedClaims } = loadPersistedState();
  let fromBlock: bigint;
  if (lastIndexed > 0n) {
    fromBlock = lastIndexed + 1n;
  } else {
    const totalWindow = 700_000n;
    fromBlock = latest > totalWindow ? latest - totalWindow : 0n;
  }

  // Restore persisted claims into the in-memory index
  for (const c of persistedClaims) {
    claimIndex.set(c.claimId, c);
  }

  let indexed = 0;
  let totalLogs = 0;

  console.log(`[indexer] Catch-up scan: blocks ${fromBlock}–${latest} (last indexed: ${lastIndexed}, restored ${persistedClaims.length} claims)`);

  for (let start = fromBlock; start <= latest; start += chunkSize) {
    const end = start + chunkSize - 1n > latest ? latest : start + chunkSize - 1n;
    let logs: Awaited<ReturnType<typeof publicClient.getLogs>> = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        logs = await publicClient.getLogs({
          address: ADDRESSES.attestationRegistry,
          fromBlock: start,
          toBlock: end,
        });
        break;
      } catch (err) {
        if (attempt === 2) {
          console.error(`[indexer] Chunk ${start}–${end} failed after 3 attempts:`, (err as Error).message.slice(0, 120));
        } else {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        }
      }
    }
    totalLogs += logs.length;
    if (indexed > 0 && totalLogs % 50 === 0) savePersistedState(end);
    await new Promise((r) => setTimeout(r, 1000));
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: ATTESTATION_REGISTRY_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "ClaimIssued") {
          const args = decoded.args;
          const entry: ClaimIndex = {
            claimId: args.claimId as string,
            subject: args.subject as string,
            schemaId: args.schemaId as string,
            issuer: args.issuer as string,
            blockNum: log.blockNumber ?? 0n,
            timestamp: BigInt(Math.floor(Date.now() / 1000)),
            revoked: false,
          };
          claimIndex.set(entry.claimId, entry);
          indexed++;
        } else if (decoded.eventName === "ClaimRevoked") {
          const existing = claimIndex.get(decoded.args.claimId as string);
          if (existing) existing.revoked = true;
        }
      } catch {
        // skip non-matching logs
      }
    }
  }
  console.log(`[indexer] Catch-up scan: indexed ${indexed} claims (${totalLogs} total logs) from blocks ${fromBlock}–${latest}`);
  savePersistedState(latest);

  if (indexed === 0 && lastIndexed === 0n) {
    console.log("[indexer] 0 claims found — waiting 30s then retrying (RPC may have been rate-limited)");
    await new Promise((r) => setTimeout(r, 30_000));
    await _catchUpScanOnce(fromBlock, latest, chunkSize);
  }
}

/** Single-pass scan without retry — used by the retry path above to avoid infinite loops. */
async function _catchUpScanOnce(fromBlock: bigint, latest: bigint, chunkSize: bigint) {
  let indexed = 0;
  let totalLogs = 0;

  for (let start = fromBlock; start <= latest; start += chunkSize) {
    const end = start + chunkSize - 1n > latest ? latest : start + chunkSize - 1n;
    let logs: Awaited<ReturnType<typeof publicClient.getLogs>> = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        logs = await publicClient.getLogs({
          address: ADDRESSES.attestationRegistry,
          fromBlock: start,
          toBlock: end,
        });
        break;
      } catch (err) {
        if (attempt === 2) {
          console.error(`[indexer] Retry chunk ${start}–${end} failed:`, (err as Error).message.slice(0, 100));
        } else {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        }
      }
    }
    totalLogs += logs.length;
    await new Promise((r) => setTimeout(r, 1000));
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: ATTESTATION_REGISTRY_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "ClaimIssued") {
          const args = decoded.args;
          const entry: ClaimIndex = {
            claimId: args.claimId as string,
            subject: args.subject as string,
            schemaId: args.schemaId as string,
            issuer: args.issuer as string,
            blockNum: log.blockNumber ?? 0n,
            timestamp: BigInt(Math.floor(Date.now() / 1000)),
            revoked: false,
          };
          claimIndex.set(entry.claimId, entry);
          indexed++;
        } else if (decoded.eventName === "ClaimRevoked") {
          const existing = claimIndex.get(decoded.args.claimId as string);
          if (existing) existing.revoked = true;
        }
      } catch {
        // skip non-matching logs
      }
    }
  }
  console.log(`[indexer] Retry scan: indexed ${indexed} claims (${totalLogs} total logs)`);
}

export function getIndexedClaim(claimId: string): ClaimIndex | undefined {
  return claimIndex.get(claimId);
}

export function getClaimsBySubject(subject: string, includeRevoked = false): ClaimIndex[] {
  const results: ClaimIndex[] = [];
  for (const entry of claimIndex.values()) {
    if (entry.subject.toLowerCase() === subject.toLowerCase()) {
      if (includeRevoked || !entry.revoked) {
        results.push(entry);
      }
    }
  }
  return results;
}

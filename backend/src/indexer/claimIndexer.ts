import { publicClient, wsClient } from "../services/arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { processEvent } from "../monitoring/eventMonitor.js";
import { notifyClaimIssued, notifyClaimRevoked } from "../services/notificationService.js";
import { decodeEventLog } from "viem";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { rpcGate } from "../utils/rpcSemaphore.js";

interface ClaimIndex {
  claimId: string;
  subject: string;
  schemaId: string;
  issuer: string;
  blockNum: bigint;
  timestamp: bigint;
  revoked: boolean;
  // EAS-enrichment fields (filled via getClaim; optional for back-compat).
  dataCommitment?: string;
  issuedAt?: bigint;
  expiresAt?: bigint;
  refUID?: string;
  revokedAt?: bigint;
}

export interface EASClaim {
  claimId: string;
  subject: string;
  schemaId: string;
  issuer: string;
  dataCommitment: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  refUID: string;
  revokedAt: number;
  blockNum: number;
}

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export function toEASClaim(e: ClaimIndex): EASClaim {
  return {
    claimId: e.claimId,
    subject: e.subject,
    schemaId: e.schemaId,
    issuer: e.issuer,
    dataCommitment: e.dataCommitment ?? ZERO_BYTES32,
    issuedAt: Number(e.issuedAt ?? e.timestamp),
    expiresAt: Number(e.expiresAt ?? 0n),
    revoked: e.revoked,
    refUID: e.refUID ?? ZERO_BYTES32,
    revokedAt: Number(e.revokedAt ?? 0n),
    blockNum: Number(e.blockNum),
  };
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
    dataCommitment?: string;
    issuedAt?: string;
    expiresAt?: string;
    refUID?: string;
    revokedAt?: string;
  }>;
}

let persistedBlock = 0n;

function loadPersistedState(): { lastIndexed: bigint; claims: ClaimIndex[] } {
  try {
    if (existsSync(STATE_FILE)) {
      const state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as PersistedState;
      const lastIndexed = state.lastIndexedBlock ? BigInt(state.lastIndexedBlock) : 0n;
      persistedBlock = lastIndexed;
      const claims = (state.claims ?? []).map((c) => ({
        ...c,
        blockNum: BigInt(c.blockNum),
        timestamp: BigInt(c.timestamp),
        issuedAt: c.issuedAt ? BigInt(c.issuedAt) : undefined,
        expiresAt: c.expiresAt ? BigInt(c.expiresAt) : undefined,
        revokedAt: c.revokedAt ? BigInt(c.revokedAt) : undefined,
      }));
      return { lastIndexed, claims };
    }
  } catch { /* ignore */ }
  return { lastIndexed: 0n, claims: [] };
}

function savePersistedState(block: bigint) {
  try {
    persistedBlock = block;
    const claims = Array.from(claimIndex.values()).map((c) => ({
      ...c,
      blockNum: c.blockNum.toString(),
      timestamp: c.timestamp.toString(),
      issuedAt: (c.issuedAt ?? c.timestamp).toString(),
      expiresAt: (c.expiresAt ?? 0n).toString(),
      revokedAt: (c.revokedAt ?? 0n).toString(),
    }));
    writeFileSync(STATE_FILE, JSON.stringify({
      lastIndexedBlock: block.toString(),
      claims,
    }));
  } catch { /* ignore */ }
}

/** Persist live inserts/enrichments without moving the catch-up watermark backwards. */
function persistLive(blockNum: bigint) {
  try {
    if (blockNum > persistedBlock) persistedBlock = blockNum;
    savePersistedState(persistedBlock);
    // savePersistedState overwrites persistedBlock with itself — no-op, keeps value.
  } catch { /* ignore */ }
}

/** Fetch full claim details on-chain and fill EAS fields. Best-effort, rate-limited. */
async function enrichClaim(claimId: string): Promise<void> {
  if (!ADDRESSES.attestationRegistry) return;
  const key = claimId.toLowerCase();
  const existing = claimIndex.get(key) ?? claimIndex.get(claimId);
  if (!existing) return;
  // Skip if already enriched.
  if (existing.expiresAt !== undefined && existing.dataCommitment) return;
  try {
    const raw = await rpcGate(() =>
      publicClient.readContract({
        address: ADDRESSES.attestationRegistry!,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: "getClaim",
        args: [existing.claimId as `0x${string}`],
      })
    );
    const entry = claimIndex.get(key) ?? claimIndex.get(claimId);
    if (!entry) return;
    entry.dataCommitment = raw[4] as string;
    entry.issuedAt = BigInt(raw[5] as bigint);
    entry.expiresAt = BigInt(raw[6] as bigint);
    entry.revoked = Boolean(raw[7]);
    entry.refUID = (raw[8] as string) || ZERO_BYTES32;
    entry.revokedAt = BigInt((raw[9] as bigint) ?? 0n);
  } catch {
    /* leave defaults — detail endpoint falls back to on-chain read per-request */
  }
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

  // Use WebSocket for live events if available (push-based, no polling).
  // Falls back to HTTP polling if ARC_WS_RPC_URL is not set.
  const liveClient = wsClient ?? publicClient;

  liveClient.watchContractEvent({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_REGISTRY_ABI,
    eventName: "ClaimIssued",
    ...(wsClient ? {} : { pollingInterval: 30_000 }),
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
        if (!entry.claimId) continue;
        claimIndex.set(entry.claimId.toLowerCase(), entry);
        persistLive(log.blockNumber);
        // Enrich with full on-chain fields (expiresAt, refUID, ...) without blocking.
        void enrichClaim(entry.claimId).then(() => persistLive(log.blockNumber));

        // Live-event notification: subjects learn when a credential is issued to them.
        // (The historical catch-up scan below intentionally does NOT notify.)
        notifyClaimIssued({
          claimId:  entry.claimId,
          subject:  entry.subject,
          issuer:   entry.issuer,
          schemaId: entry.schemaId,
        });

        processEvent({
          name: "ClaimIssued",
          args: log.args as Record<string, unknown>,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex ?? 0,
        });
      }
    },
    onError: () => {},
  });

  // Listen for ClaimRevoked events and mark claims as revoked in the index.
  // Without this handler, revoked claims persist in-memory as valid until the
  // onchain isValid() spot-check in passportService catches them — a correctness
  // gap per AGENTS.md §4.4 and §15.2.6.
  liveClient.watchContractEvent({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_REGISTRY_ABI,
    eventName: "ClaimRevoked",
    ...(wsClient ? {} : { pollingInterval: 30_000 }),
    onLogs: (logs) => {
      for (const log of logs) {
        const claimId = (log.args.claimId ?? "") as string;
        const existing = claimIndex.get(claimId.toLowerCase());
        if (existing) {
          existing.revoked = true;
          persistLive(log.blockNumber);
          existing.revoked = true;
          notifyClaimRevoked({
            claimId: existing.claimId,
            subject: existing.subject,
            revoker: (log.args.revoker ?? "") as string,
          });
        }

        processEvent({
          name: "ClaimRevoked",
          args: log.args as Record<string, unknown>,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex ?? 0,
        });
      }
    },
    onError: () => {},
  });

  console.log("[indexer] ClaimIndexer started");
}

async function _catchUpScan() {
  const latest = await publicClient.getBlockNumber();
  const chunkSize = 1000n;
  const { lastIndexed: lastIndexed, claims: persistedClaims } = loadPersistedState();
  let fromBlock: bigint;
  if (lastIndexed > 0n) {
    fromBlock = lastIndexed + 1n;
  } else {
    const totalWindow = 50_000n; // Reduced from 700k to avoid RPC rate limits
    fromBlock = latest > totalWindow ? latest - totalWindow : 0n;
  }

  // Restore persisted claims into the in-memory index (normalize keys).
  for (const c of persistedClaims) {
    claimIndex.set(c.claimId.toLowerCase(), c);
  }

  let indexed = 0;
  let totalLogs = 0;

  console.log(`[indexer] Catch-up scan: blocks ${fromBlock}–${latest} (last indexed: ${lastIndexed}, restored ${persistedClaims.length} claims)`);

  for (let start = fromBlock; start <= latest; start += chunkSize) {
    const end = start + chunkSize - 1n > latest ? latest : start + chunkSize - 1n;
    let logs: Awaited<ReturnType<typeof publicClient.getLogs>> = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        logs = await rpcGate(() =>
          publicClient.getLogs({
            address: ADDRESSES.attestationRegistry,
            fromBlock: start,
            toBlock: end,
          })
        );
        break;
      } catch (err) {
        const msg = (err as Error).message;
        const isRateLimit = msg.includes("rate limit") || msg.includes("exceeds defined limit");
        if (attempt === 4) {
          console.error(`[indexer] Chunk ${start}–${end} failed after 5 attempts:`, msg.slice(0, 120));
        } else {
          const backoff = isRateLimit ? 5000 * Math.pow(2, attempt) : 3000 * (attempt + 1);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }
    totalLogs += logs.length;
    if (indexed > 0 && totalLogs % 50 === 0) savePersistedState(end);
    await new Promise((r) => setTimeout(r, 8000));
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
          claimIndex.set(entry.claimId.toLowerCase(), entry);
          indexed++;
        } else if (decoded.eventName === "ClaimRevoked") {
          const existing = claimIndex.get((decoded.args.claimId as string).toLowerCase());
          if (existing) existing.revoked = true;
        }
      } catch {
        // skip non-matching logs
      }
    }
  }
  console.log(`[indexer] Catch-up scan: indexed ${indexed} claims (${totalLogs} total logs) from blocks ${fromBlock}–${latest}`);
  savePersistedState(latest);

  // Background enrichment: fill expiresAt / refUID / dataCommitment for EAS views.
  // Slow + best-effort so we don't hammer the RPC after a long scan.
  void (async () => {
    const missing = Array.from(claimIndex.values()).filter((c) => c.expiresAt === undefined);
    if (missing.length === 0) return;
    console.log(`[indexer] Enriching ${missing.length} claims with on-chain details`);
    for (const c of missing.slice(0, 500)) {
      await enrichClaim(c.claimId);
      await new Promise((r) => setTimeout(r, 400));
    }
    savePersistedState(latest);
  })();

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
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        logs = await rpcGate(() =>
          publicClient.getLogs({
            address: ADDRESSES.attestationRegistry,
            fromBlock: start,
            toBlock: end,
          })
        );
        break;
      } catch (err) {
        if (attempt === 4) {
          console.error(`[indexer] Retry chunk ${start}–${end} failed:`, (err as Error).message.slice(0, 100));
        } else {
          const msg = (err as Error).message;
          const isRateLimit = msg.includes("rate limit") || msg.includes("exceeds defined limit");
          const backoff = isRateLimit ? 5000 * Math.pow(2, attempt) : 3000 * (attempt + 1);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }
    totalLogs += logs.length;
    await new Promise((r) => setTimeout(r, 3500));
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
          claimIndex.set(entry.claimId.toLowerCase(), entry);
          indexed++;
        } else if (decoded.eventName === "ClaimRevoked") {
          const existing = claimIndex.get((decoded.args.claimId as string).toLowerCase());
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
  return claimIndex.get(claimId.toLowerCase()) ?? claimIndex.get(claimId);
}

/** All indexed claims — used by the notification expiry sweep. */
export function getAllIndexedClaims(): ClaimIndex[] {
  return Array.from(claimIndex.values());
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

// ── EAS-compatible read model (single source for /eas routes) ──

export function getEASClaims(): EASClaim[] {
  return Array.from(claimIndex.values()).map(toEASClaim);
}

export function getEASClaim(claimId: string): EASClaim | undefined {
  const e = claimIndex.get(claimId.toLowerCase());
  if (e) return toEASClaim(e);
  // Fall back to case-sensitive lookup for legacy keys.
  const direct = claimIndex.get(claimId);
  return direct ? toEASClaim(direct) : undefined;
}

export function getEASClaimsBySubject(subject: string): EASClaim[] {
  const lower = subject.toLowerCase();
  return Array.from(claimIndex.values())
    .filter((c) => c.subject.toLowerCase() === lower)
    .map(toEASClaim);
}

export function getEASClaimsByIssuer(issuer: string): EASClaim[] {
  const lower = issuer.toLowerCase();
  return Array.from(claimIndex.values())
    .filter((c) => c.issuer.toLowerCase() === lower)
    .map(toEASClaim);
}

export function getEASClaimsBySchema(schemaId: string): EASClaim[] {
  const lower = schemaId.toLowerCase();
  return Array.from(claimIndex.values())
    .filter((c) => c.schemaId.toLowerCase() === lower)
    .map(toEASClaim);
}

export function getEASReferencedClaims(claimId: string): EASClaim[] {
  const lower = claimId.toLowerCase();
  return Array.from(claimIndex.values())
    .filter((c) => (c.refUID ?? ZERO_BYTES32).toLowerCase() === lower)
    .map(toEASClaim);
}

export function getEASStats() {
  const claims = Array.from(claimIndex.values()).map(toEASClaim);
  const now = Math.floor(Date.now() / 1000);
  const valid = claims.filter((c) => !c.revoked && (c.expiresAt === 0 || c.expiresAt > now));
  const revoked = claims.filter((c) => c.revoked);
  const expired = claims.filter((c) => !c.revoked && c.expiresAt > 0 && c.expiresAt <= now);
  const uniqueSubjects = new Set(claims.map((c) => c.subject.toLowerCase())).size;
  const uniqueIssuers = new Set(claims.map((c) => c.issuer.toLowerCase())).size;
  const uniqueSchemas = new Set(claims.map((c) => c.schemaId.toLowerCase())).size;
  const withRef = claims.filter((c) => c.refUID !== ZERO_BYTES32).length;

  return {
    total: claims.length,
    valid: valid.length,
    revoked: revoked.length,
    expired: expired.length,
    uniqueSubjects,
    uniqueIssuers,
    uniqueSchemas,
    withReference: withRef,
    indexerReady: _catchUpDone,
  };
}

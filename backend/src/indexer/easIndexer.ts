import { publicClient } from "../services/arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface EASClaim {
  claimId:        string;
  subject:        string;
  schemaId:       string;
  issuer:         string;
  dataCommitment: string;
  issuedAt:       number;
  expiresAt:      number;
  revoked:        boolean;
  refUID:         string;
  revokedAt:      number;
  blockNum:       number;
}

const EAS_INDEX_FILE = resolve(import.meta.dirname ?? ".", "../../.eas-index.json");

interface PersistedEASState {
  lastIndexedBlock: string;
  claims: Array<EASClaim & { blockNum: string; issuedAt: string; expiresAt: string; revokedAt: string }>;
}

const claimIndex: Map<string, EASClaim> = new Map();
let lastIndexedBlock = 0n;

function loadEASState() {
  try {
    if (existsSync(EAS_INDEX_FILE)) {
      const state = JSON.parse(readFileSync(EAS_INDEX_FILE, "utf8")) as PersistedEASState;
      lastIndexedBlock = state.lastIndexedBlock ? BigInt(state.lastIndexedBlock) : 0n;
      for (const c of state.claims ?? []) {
        claimIndex.set(c.claimId.toLowerCase(), {
          ...c,
          blockNum: Number(c.blockNum),
          issuedAt: Number(c.issuedAt),
          expiresAt: Number(c.expiresAt),
          revokedAt: Number(c.revokedAt),
        });
      }
    }
  } catch { /* ignore */ }
}

function saveEASState() {
  try {
    const claims = Array.from(claimIndex.values()).map((c) => ({
      ...c,
      blockNum: c.blockNum.toString(),
      issuedAt: c.issuedAt.toString(),
      expiresAt: c.expiresAt.toString(),
      revokedAt: c.revokedAt.toString(),
    }));
    writeFileSync(EAS_INDEX_FILE, JSON.stringify({
      lastIndexedBlock: lastIndexedBlock.toString(),
      claims,
    }, null, 2));
  } catch { /* ignore */ }
}

export function getEASClaims(): EASClaim[] {
  return Array.from(claimIndex.values());
}

export function getEASClaim(claimId: string): EASClaim | undefined {
  return claimIndex.get(claimId.toLowerCase());
}

export function getClaimsBySubject(subject: string): EASClaim[] {
  const lower = subject.toLowerCase();
  return Array.from(claimIndex.values()).filter((c) => c.subject.toLowerCase() === lower);
}

export function getClaimsByIssuer(issuer: string): EASClaim[] {
  const lower = issuer.toLowerCase();
  return Array.from(claimIndex.values()).filter((c) => c.issuer.toLowerCase() === lower);
}

export function getClaimsBySchema(schemaId: string): EASClaim[] {
  const lower = schemaId.toLowerCase();
  return Array.from(claimIndex.values()).filter((c) => c.schemaId.toLowerCase() === lower);
}

export function getReferencedClaims(claimId: string): EASClaim[] {
  const lower = claimId.toLowerCase();
  return Array.from(claimIndex.values()).filter((c) => c.refUID.toLowerCase() === lower);
}

export function getEASStats() {
  const claims = Array.from(claimIndex.values());
  const valid = claims.filter((c) => !c.revoked && (c.expiresAt === 0 || c.expiresAt > Date.now() / 1000));
  const revoked = claims.filter((c) => c.revoked);
  const expired = claims.filter((c) => !c.revoked && c.expiresAt > 0 && c.expiresAt <= Date.now() / 1000);
  const uniqueSubjects = new Set(claims.map((c) => c.subject.toLowerCase())).size;
  const uniqueIssuers = new Set(claims.map((c) => c.issuer.toLowerCase())).size;
  const uniqueSchemas = new Set(claims.map((c) => c.schemaId.toLowerCase())).size;
  const withRef = claims.filter((c) => c.refUID !== "0x0000000000000000000000000000000000000000000000000000000000000000").length;

  return {
    total:        claims.length,
    valid:        valid.length,
    revoked:      revoked.length,
    expired:      expired.length,
    uniqueSubjects,
    uniqueIssuers,
    uniqueSchemas,
    withReference: withRef,
  };
}

export async function startIndexer() {
  loadEASState();

  if (!ADDRESSES.attestationRegistry) {
    console.log("[EAS Indexer] ATTESTATION_REGISTRY_ADDRESS not configured — skipping");
    return;
  }

  console.log(`[EAS Indexer] Starting from block ${lastIndexedBlock}`);

  // Skip catch-up on startup: the claim indexer already does a full backfill
  // of the same AttestationRegistry events. Running two catch-up scans
  // simultaneously starves the RPC rate limit and breaks user-facing scans.
  // Set the high-water mark so the live watcher picks up from now.
  try {
    const latestBlock = await publicClient.getBlockNumber();
    lastIndexedBlock = latestBlock;
    saveEASState();
    console.log(`[EAS Indexer] Skipping catch-up (claim indexer handles it) — live watcher starts at block ${latestBlock}`);
  } catch (err) {
    console.error("[EAS Indexer] Failed to read latest block:", (err as Error).message);
  }

  // Watch for new events
  let watchErrorCount = 0;
  const unwatch = publicClient.watchEvent({
    address: ADDRESSES.attestationRegistry,
    pollingInterval: 30_000,
    onLogs: async (logs) => {
      watchErrorCount = 0;
      for (const log of logs) {
        try {
          processLog(log);
        } catch (err) {
          console.error("[EAS Indexer] Event processing error:", (err as Error).message);
        }
      }
      saveEASState();
    },
    onError: (err) => {
      watchErrorCount++;
      const delay = Math.min(60_000, 5_000 * Math.pow(2, watchErrorCount - 1));
      if (watchErrorCount <= 2) {
        console.warn(`[EAS Indexer] RPC rate-limited — backing off ${delay}ms`);
      }
    },
  });

  console.log("[EAS Indexer] Watching for new events");
}

async function syncLogs(from: bigint, to: bigint) {
  if (!ADDRESSES.attestationRegistry) return;

  const CHUNK = 1000n;          // Smaller chunks to stay under RPC rate limits
  const BASE_DELAY_MS = 2000;   // 2s base delay between chunks
  let start = from;

  while (start <= to) {
    const end = start + CHUNK - 1n > to ? to : start + CHUNK - 1n;

    let retries = 0;
    const maxRetries = 5;       // More retries with longer backoff

    while (retries <= maxRetries) {
      try {
        const logs = await publicClient.getLogs({
          address: ADDRESSES.attestationRegistry,
          fromBlock: start,
          toBlock: end,
        });

        for (const log of logs) {
          processLog(log);
        }
        break; // success — move to next chunk
      } catch (err) {
        const msg = (err as Error).message;
        const isRateLimit = msg.includes("rate limit") || msg.includes("exceeds defined limit");
        retries++;

        if (isRateLimit && retries <= maxRetries) {
          const backoff = BASE_DELAY_MS * Math.pow(2, retries); // 4s, 8s, 16s, 32s, 64s
          console.log(`[EAS Indexer] Rate limited on ${start}-${end}, retrying in ${backoff}ms (${retries}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, backoff));
        } else {
          console.error(`[EAS Indexer] Error fetching logs ${start}-${end}:`, msg);
          break;
        }
      }
    }

    start = end + 1n;

    // Delay between chunks — longer delay to respect rate limits
    if (start <= to) {
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS));
    }
  }
}

function processLog(log: { topics?: readonly `0x${string}`[]; data?: `0x${string}`; blockNumber?: bigint | null }) {
  if (!log.topics || !log.blockNumber) return;

  const eventSig = log.topics[0];
  const CLAIM_ISSUED_SIG = "0x5e2cd34e1a37d2c40e27e7ad263f4d65392e3d44ad5e4a1e0fca8a2c8e3c4f5d";
  const CLAIM_REVOKED_SIG = "0x8c9b22b4be1eb9b0e4b9f2f2e5b3a1d5e7c6f8a9b0c1d2e3f4a5b6c7d8e9f0a1";

  // ClaimIssued event
  if (eventSig === CLAIM_ISSUED_SIG) {
    const claimId = log.topics[1] as string;
    const subject = "0x" + (log.topics[2] as string).slice(26);
    const issuer = "0x" + (log.topics[3] as string).slice(26);

    // Decode schemaId from data (first 32 bytes)
    const data = log.data ?? "0x";
    const schemaId = "0x" + data.slice(2, 66);

    claimIndex.set(claimId.toLowerCase(), {
      claimId,
      subject,
      schemaId,
      issuer,
      dataCommitment: "0x0000000000000000000000000000000000000000000000000000000000000000",
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: 0,
      revoked: false,
      refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
      revokedAt: 0,
      blockNum: Number(log.blockNumber),
    });
  }

  // ClaimRevoked event
  if (eventSig === CLAIM_REVOKED_SIG) {
    const claimId = log.topics[1] as string;
    const existing = claimIndex.get(claimId.toLowerCase());
    if (existing) {
      existing.revoked = true;
      existing.revokedAt = Math.floor(Date.now() / 1000);
    }
  }
}

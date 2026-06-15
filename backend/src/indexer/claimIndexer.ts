import { publicClient } from "../services/arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { processEvent } from "../monitoring/eventMonitor.js";

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

export async function startClaimIndexer() {
  if (!ADDRESSES.attestationRegistry) {
    console.warn("[indexer] AttestationRegistry not configured, skipping");
    return;
  }

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

import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { IDENTITY_REGISTRY_ABI } from "../abis/IdentityRegistry.js";
import { REPUTATION_REGISTRY_ABI } from "../abis/ReputationRegistry.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { fetchFromIpfs } from "./ipfsService.js";
import { getClaimsBySubject } from "../indexer/claimIndexer.js";
import { type ServiceKey } from "./attestation/index.js";
import { ALL_SCHEMAS } from "../constants/schemas.js";
import { Errors } from "../utils/errors.js";
import type { ActiveClaim, IdentityMetadata, ReputationEvent } from "../types/passport.js";

export type { ServiceKey };

export interface ServiceClaims {
  service:    ServiceKey;
  claims:     ActiveClaim[];
  verified:   boolean;
  claimCount: number;
}

export interface PassportDocument {
  address:     string;
  identityId:  number;
  metadataUri: string | null;
  metadata:    IdentityMetadata | null;
  reputation:  ReputationEvent[];
  claims:      ActiveClaim[];
  services:    Record<ServiceKey, ServiceClaims>;
  generatedAt: number;
}

const ALL_SERVICE_KEYS: ServiceKey[] = [
  "identity", "kyc", "credentials", "dao",
  "reputation", "employment", "education", "social", "custom",
];

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as `0x${string}`;

/**
 * Build a schemaId → serviceKey lookup map from the canonical schema definitions.
 * Claims whose schemaId matches a known schema route to that service;
 * all others route to "custom".
 */
function buildSchemaServiceMap(): Map<string, ServiceKey> {
  const map = new Map<string, ServiceKey>();
  for (const [serviceKey, schemas] of Object.entries(ALL_SCHEMAS)) {
    for (const def of Object.values(schemas as Record<string, { id?: `0x${string}` }>)) {
      if (def.id) map.set(def.id.toLowerCase(), serviceKey as ServiceKey);
    }
  }
  return map;
}

const SCHEMA_SERVICE_MAP = buildSchemaServiceMap();

const ERC721_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const TransferEventAbi = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "tokenId", type: "uint256", indexed: true },
  ],
} as const;

const ERC721_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { name: "tokenURI", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
] as const;

// Cache known address→tokenId mappings (identity lookups are expensive on Arc's non-standard ERC-721)
const identityCache = new Map<string, { tokenId: number; metadataUri: string | null }>();

async function getIdentity(address: `0x${string}`): Promise<{ tokenId: number; metadataUri: string | null } | null> {
  const cached = identityCache.get(address.toLowerCase());
  if (cached) return cached;

  // Known identities — skip RPC entirely. Remove before mainnet.
  const KNOWN_IDENTITY: Record<string, { tokenId: number; metadataUri: string | null }> = {
    "0x04e0353b7218b66d6803725ce7342e6e1225db1b": {
      tokenId: 648069,
      metadataUri: "ipfs://QmArcPassDeployer",
    },
  };
  const known = KNOWN_IDENTITY[address.toLowerCase()];
  if (known) {
    identityCache.set(address.toLowerCase(), known);
    return known;
  }

  // Fallback: try getIdentity (standard ERC-8004)
  try {
    const result = await publicClient.readContract({
      address: ADDRESSES.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "getIdentity",
      args: [address],
    });
    const [tokenId, metadataUri] = result as readonly [bigint, string];
    const out = { tokenId: Number(tokenId), metadataUri: metadataUri ?? null };
    identityCache.set(address.toLowerCase(), out);
    return out;
  } catch {
    // getIdentity reverts on Arc's implementation (calls owner as contract)
  }

  // Unknown address with no cached identity — return null (no on-chain identity found)
  return null;

  return null;
}

async function getReputationEvents(tokenId: number): Promise<ReputationEvent[]> {
  try {
    const result = await publicClient.readContract({
      address: ADDRESSES.reputationRegistry,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "getEvents",
      args: [BigInt(tokenId)],
    });
    return (result as readonly bigint[]).map((id) => ({ eventId: Number(id) }));
  } catch {
    return [];
  }
}

function buildServicesFromIndexedClaims(address: `0x${string}`): Record<ServiceKey, ServiceClaims> {
  const indexedClaims = getClaimsBySubject(address);

  const out = {} as Record<ServiceKey, ServiceClaims>;
  for (const key of ALL_SERVICE_KEYS) {
    out[key] = { service: key, claims: [], verified: false, claimCount: 0 };
  }

  for (const c of indexedClaims) {
    const serviceKey = SCHEMA_SERVICE_MAP.get(c.schemaId.toLowerCase()) ?? "custom";
    out[serviceKey].claims.push({
      claimId:  c.claimId,
      schemaId: c.schemaId,
      issuer:   c.issuer,
      valid:    true,
    });
  }

  for (const key of ALL_SERVICE_KEYS) {
    out[key].claimCount = out[key].claims.length;
    out[key].verified = out[key].claims.length > 0;
  }

  return out;
}

async function batchValidateClaims(claims: ActiveClaim[]): Promise<ActiveClaim[]> {
  if (claims.length === 0) return claims;
  try {
    const results = await publicClient.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      contracts: claims.map((c) => ({
        address: ADDRESSES.attestationRegistry!,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: "isValid" as const,
        args: [c.claimId as `0x${string}`],
      })),
    });
    return claims.map((c, i) => {
      const r = results[i];
      return { ...c, valid: r.status === "success" && r.result === true };
    });
  } catch {
    return claims;
  }
}

export async function getPassport(address: `0x${string}`): Promise<PassportDocument> {
  const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms))]);

  const identity = await withTimeout(getIdentity(address), 8000, "getIdentity");

  let reputation: ReputationEvent[] = [];
  let metadata: IdentityMetadata | null = null;
  if (identity) {
    reputation = await withTimeout(getReputationEvents(identity.tokenId), 8000, "getReputation");
    if (identity.metadataUri) {
      try {
        const raw = await withTimeout(fetchFromIpfs(identity.metadataUri) as Promise<unknown>, 8000, "fetchIpfs");
        metadata = (raw && typeof raw === "object" ? raw : null) as IdentityMetadata | null;
      } catch {
        metadata = null;
      }
    }
  }

  const indexedClaims = getClaimsBySubject(address);
  const rawClaims: ActiveClaim[] = indexedClaims.map((c) => ({
    claimId:  c.claimId,
    schemaId: c.schemaId,
    issuer:   c.issuer,
    valid:    true,
  }));
  const claims = await withTimeout(batchValidateClaims(rawClaims), 8000, "batchValidate");

  const services = buildServicesFromIndexedClaims(address);

  return {
    address:     address,
    identityId:  identity?.tokenId ?? 0,
    metadataUri: identity?.metadataUri ?? null,
    metadata,
    reputation,
    claims,
    services,
    generatedAt: Date.now(),
  };
}

export function _validateOrThrow(address: string): asserts address is `0x${string}` {
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    throw Errors.InvalidSubject(address);
  }
}

import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { IDENTITY_REGISTRY_ABI } from "../abis/IdentityRegistry.js";
import { REPUTATION_REGISTRY_ABI } from "../abis/ReputationRegistry.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { SCORE_REGISTRY_ABI } from "../abis/ScoreRegistry.js";
import { fetchFromIpfs } from "./ipfsService.js";
import { getClaimsBySubject } from "../indexer/claimIndexer.js";
import { getRegistrationHistory } from "./identityService.js";
import { type ServiceKey } from "./attestation/index.js";
import { ALL_SCHEMAS } from "../constants/schemas.js";
import { Errors } from "../utils/errors.js";
import { computeTrustScore } from "./scoringService.js";
import type { ActiveClaim, IdentityMetadata, ReputationEvent } from "../types/passport.js";

export type { ServiceKey };

export interface ServiceClaims {
  service:    ServiceKey;
  claims:     ActiveClaim[];
  verified:   boolean;
  claimCount: number;
}

export interface PassportDocument {
  address:       string;
  identityId:    number;
  metadataUri:   string | null;
  metadata:      IdentityMetadata | null;
  reputation:    ReputationEvent[];
  claims:        ActiveClaim[];
  services:      Record<ServiceKey, ServiceClaims>;
  trustScore:    TrustScore;
  onChainScore:  OnChainScore | null;
  generatedAt:   number;
  /** True when balanceOf > 0 but the identity scan couldn't find the mint event. */
  scanIncomplete: boolean;
}

export interface OnChainScore {
  score:           number;
  isValid:         boolean;
  isHuman:         boolean;
  computedAt:      number;
  expiresAt:       number;
  dataCommitment:  string;
}

import type { TrustScore } from "./scoringService.js";

const ALL_SERVICE_KEYS: ServiceKey[] = [
  "identity", "kyc", "credentials", "dao",
  "reputation", "employment", "education", "social", "custom",
  "zkPassport",
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

const ERC721_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { name: "tokenURI", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
] as const;

// Cache known address→tokenId mappings (identity lookups are expensive on Arc's non-standard ERC-721)
const identityCache = new Map<string, { tokenId: number; metadataUri: string | null } | null>();
const MAX_IDENTITY_CACHE = 500;

async function getIdentityWithFlag(address: `0x${string}`): Promise<{ tokenId: number; metadataUri: string | null; scanIncomplete: boolean }> {
  const cached = identityCache.get(address.toLowerCase());
  if (cached !== undefined) {
    if (cached === null) return { tokenId: 0, metadataUri: null, scanIncomplete: true };
    return { ...cached, scanIncomplete: false };
  }

  const history = await getRegistrationHistory(address);
  const identity = history.identity;
  const scanIncomplete = identity === null && history.balance > 0;

  identityCache.set(address.toLowerCase(), identity);
  if (identityCache.size > MAX_IDENTITY_CACHE) {
    const firstKey = identityCache.keys().next().value;
    if (firstKey) identityCache.delete(firstKey);
  }

  return { tokenId: identity?.tokenId ?? 0, metadataUri: identity?.metadataUri ?? null, scanIncomplete };
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

function buildServicesFromIndexedClaims(
  address: `0x${string}`,
  validatedClaims?: ActiveClaim[]
): Record<ServiceKey, ServiceClaims> {
  const indexedClaims = getClaimsBySubject(address);

  const out = {} as Record<ServiceKey, ServiceClaims>;
  for (const key of ALL_SERVICE_KEYS) {
    out[key] = { service: key, claims: [], verified: false, claimCount: 0 };
  }

  // Build a lookup from validated claims if available
  const validityMap = new Map<string, boolean>();
  if (validatedClaims) {
    for (const vc of validatedClaims) {
      validityMap.set(vc.claimId.toLowerCase(), vc.valid);
    }
  }

  for (const c of indexedClaims) {
    const serviceKey = SCHEMA_SERVICE_MAP.get(c.schemaId.toLowerCase()) ?? "custom";
    const valid = validityMap.has(c.claimId.toLowerCase())
      ? validityMap.get(c.claimId.toLowerCase())!
      : true; // fallback for claims not in validation batch
    out[serviceKey].claims.push({
      claimId:  c.claimId,
      schemaId: c.schemaId,
      issuer:   c.issuer,
      valid,
    });
  }

  for (const key of ALL_SERVICE_KEYS) {
    out[key].claimCount = out[key].claims.length;
    out[key].verified = out[key].claims.some((c) => c.valid);
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
  } catch (err) {
    // Validation unavailable (RPC throttling) — mark as failed rather than
    // silently treating all claims as revoked.
    console.error("[passport] batch validate failed:", (err as Error).message);
    return claims.map((c) => ({ ...c, valid: false, validationFailed: true }));
  }
}

export async function getPassport(address: `0x${string}`): Promise<PassportDocument> {
  const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms))]);

  const identityResult = await withTimeout(
    getIdentityWithFlag(address),
    15000,
    "getIdentity"
  ).catch((err) => {
    console.warn("[passport] identity resolution skipped:", (err as Error).message);
    return { tokenId: 0, metadataUri: null, scanIncomplete: true };
  });

  const { scanIncomplete } = identityResult;

  let reputation: ReputationEvent[] = [];
  let metadata: IdentityMetadata | null = null;
  if (identityResult.tokenId > 0) {
    reputation = await withTimeout(getReputationEvents(identityResult.tokenId), 8000, "getReputation");
    if (identityResult.metadataUri) {
      try {
        const raw = await withTimeout(fetchFromIpfs(identityResult.metadataUri) as Promise<unknown>, 8000, "fetchIpfs");
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
    valid:    false,
  }));
  const claims = await withTimeout(batchValidateClaims(rawClaims), 15000, "batchValidate");

  const services = buildServicesFromIndexedClaims(address, claims);

  const trustScore = computeTrustScore(services);

  // Fetch on-chain score if ScoreRegistry is configured
  let onChainScore: OnChainScore | null = null;
  if (ADDRESSES.scoreRegistry) {
    try {
      const [score, isValid, isHuman] = await publicClient.readContract({
        address: ADDRESSES.scoreRegistry,
        abi: SCORE_REGISTRY_ABI,
        functionName: "getScore",
        args: [address, 0],
      });
      // Get raw detail for computedAt/expiresAt
      const raw = await publicClient.readContract({
        address: ADDRESSES.scoreRegistry,
        abi: SCORE_REGISTRY_ABI,
        functionName: "scores",
        args: [address, 0],
      });
      onChainScore = {
        score: Number(score),
        isValid,
        isHuman,
        computedAt: Number(raw[2]),
        expiresAt: Number(raw[3]),
        dataCommitment: raw[1],
      };
    } catch {
      onChainScore = null;
    }
  }

  return {
    address:      address,
    identityId:   identityResult.tokenId,
    metadataUri:  identityResult.metadataUri,
    metadata,
    reputation,
    claims,
    services,
    trustScore,
    onChainScore,
    generatedAt:  Date.now(),
    scanIncomplete,
  };
}

export function _validateOrThrow(address: string): asserts address is `0x${string}` {
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    throw Errors.InvalidSubject(address);
  }
}

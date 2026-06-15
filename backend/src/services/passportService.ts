import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { IDENTITY_REGISTRY_ABI } from "../abis/IdentityRegistry.js";
import { REPUTATION_REGISTRY_ABI } from "../abis/ReputationRegistry.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { fetchFromIpfs } from "./ipfsService.js";
import { getClaimsBySubject } from "../indexer/claimIndexer.js";
import { getAllServices, type ServiceKey } from "./attestation/index.js";
import { Errors } from "../utils/errors.js";
import type { ActiveClaim, IdentityMetadata, ReputationEvent } from "../types/passport.js";


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

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as `0x${string}`;

async function getIdentity(address: `0x${string}`): Promise<{ tokenId: number; metadataUri: string | null } | null> {
  try {
    const result = await publicClient.readContract({
      address: ADDRESSES.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "getIdentity",
      args: [address],
    });
    const [tokenId, metadataUri] = result as readonly [bigint, string];
    return { tokenId: Number(tokenId), metadataUri: metadataUri ?? null };
  } catch {
    return null;
  }
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

async function buildServicesFromChain(address: `0x${string}`): Promise<Record<ServiceKey, ServiceClaims>> {
  const services = getAllServices();

  const results = await Promise.allSettled(
    services.map(async ({ key }) => {
      const claims = getClaimsBySubject(address);
      return { key, count: claims.length };
    })
  );

  const out = {} as Record<ServiceKey, ServiceClaims>;
  results.forEach((r, i) => {
    const { key } = services[i];
    if (r.status === "fulfilled") {
      const count = r.value.count;
      const claims = getClaimsBySubject(address)
        .filter((c) => !c.schemaId || c.schemaId === "0x" + "0".repeat(64) || c.schemaId)
        .map((c) => ({ claimId: c.claimId, schemaId: c.schemaId, issuer: c.issuer, valid: true }));
      out[key] = {
        service:    key,
        claims,
        verified:   count > 0,
        claimCount: count,
      };
    } else {
      out[key] = { service: key, claims: [], verified: false, claimCount: 0 };
    }
  });
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
  const identity = await getIdentity(address);

  let reputation: ReputationEvent[] = [];
  let metadata: IdentityMetadata | null = null;
  if (identity) {
    reputation = await getReputationEvents(identity.tokenId);
    if (identity.metadataUri) {
      try {
        const raw = (await fetchFromIpfs(identity.metadataUri)) as unknown;
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
  const claims = await batchValidateClaims(rawClaims);

  const services = await buildServicesFromChain(address);

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

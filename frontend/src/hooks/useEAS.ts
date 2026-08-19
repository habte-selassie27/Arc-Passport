import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../config/api";

export interface EASSchema {
  uid:         string;
  name:        string;
  description?: string;
  fields:      string;
  registry:    string;
  attestationCount?: number;
  version?:    string;
  registrant?: string;
  registeredAt?: number;
}

export interface EASAttestation {
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
  status?:        string;
  referencedClaim?: any;
  references?:    any[];
}

export interface EASStats {
  total:         number;
  valid:         number;
  revoked:       number;
  expired:       number;
  uniqueSubjects: number;
  uniqueIssuers:  number;
  uniqueSchemas:  number;
  withReference:  number;
}

export interface EASVerifyResult {
  address:          string;
  attestationCount: number;
  validCount:       number;
  revokedCount:     number;
  expiredCount:     number;
  uniqueIssuers:    number;
  uniqueSchemas:    number;
  onChainVerification: any;
  verifiedAt:       number;
}

export function useEASStats() {
  return useQuery({
    queryKey: ["eas-stats"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/eas/stats"));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as EASStats;
    },
  });
}

export function useEASSchemas() {
  return useQuery({
    queryKey: ["eas-schemas"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/eas/schemas"));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as { count: number; schemas: EASSchema[] };
    },
  });
}

export function useEASSchema(uid: string | undefined) {
  return useQuery({
    queryKey: ["eas-schema", uid],
    queryFn: async () => {
      if (!uid) return null;
      const res = await fetch(apiUrl(`/eas/schemas/${uid}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as EASSchema;
    },
    enabled: !!uid,
  });
}

export function useEASAttestations(filters?: {
  subject?: string;
  issuer?: string;
  schemaId?: string;
  valid?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.subject) params.set("subject", filters.subject);
  if (filters?.issuer) params.set("issuer", filters.issuer);
  if (filters?.schemaId) params.set("schemaId", filters.schemaId);
  if (filters?.valid) params.set("valid", filters.valid);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));

  return useQuery({
    queryKey: ["eas-attestations", filters],
    queryFn: async () => {
      const qs = params.toString();
      const res = await fetch(apiUrl(`/eas/attestations${qs ? `?${qs}` : ""}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as {
        total: number;
        page: number;
        limit: number;
        pages: number;
        attestations: EASAttestation[];
      };
    },
  });
}

export function useEASAttestation(uid: string | undefined) {
  return useQuery({
    queryKey: ["eas-attestation", uid],
    queryFn: async () => {
      if (!uid) return null;
      const res = await fetch(apiUrl(`/eas/attestations/${uid}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as EASAttestation;
    },
    enabled: !!uid,
  });
}

export function useEASVerify(address: string | undefined) {
  return useQuery({
    queryKey: ["eas-verify", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(apiUrl(`/eas/verify/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as EASVerifyResult;
    },
    enabled: !!address,
  });
}

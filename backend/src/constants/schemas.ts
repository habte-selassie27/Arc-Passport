import { keccak256, encodePacked } from "viem";

export interface SchemaDefinition {
  name: string;
  version: string;
  fields: { name: string; type: string }[];
  id?: `0x${string}`;
}

function computeId(name: string, version: string, fieldsJson: string): `0x${string}` {
  return keccak256(encodePacked(["string", "string", "string"], [name, version, fieldsJson]));
}

function fieldsToString(fields: { name: string; type: string }[]): string {
  return JSON.stringify(fields.map(({ name, type }) => ({ name, type })));
}

function finalize(s: SchemaDefinition): SchemaDefinition {
  return { ...s, id: computeId(s.name, s.version, fieldsToString(s.fields)) };
}

// ─── SERVICE 1: Identity & Passport ────────────────────────────────────────

export const IDENTITY_SCHEMAS = {
  BASIC_IDENTITY: finalize({
    name: "arcpass_identity",
    version: "3.0.0",
    fields: [
      { name: "displayName", type: "string" },
      { name: "avatarCid", type: "string" },
      { name: "createdAt", type: "uint64" },
    ],
  }),
  LIVENESS_VERIFIED: finalize({
    name: "arcpass_liveness",
    version: "3.0.0",
    fields: [
      { name: "verified", type: "bool" },
      { name: "provider", type: "string" },
      { name: "checkedAt", type: "uint64" },
    ],
  }),
} as const;

// ─── SERVICE 2: KYC / Compliance ───────────────────────────────────────────

export const KYC_SCHEMAS = {
  KYC_BASIC: finalize({
    name: "arcpass_kyc_basic",
    version: "3.0.0",
    fields: [
      { name: "level", type: "uint8" },
      { name: "country", type: "string" },
      { name: "provider", type: "string" },
      { name: "checkedAt", type: "uint64" },
    ],
  }),
  AML_SCREENING: finalize({
    name: "arcpass_aml_screening",
    version: "3.0.0",
    fields: [
      { name: "passed", type: "bool" },
      { name: "provider", type: "string" },
      { name: "checkedAt", type: "uint64" },
    ],
  }),
  ACCREDITED_INVESTOR: finalize({
    name: "arcpass_accredited_investor",
    version: "3.0.0",
    fields: [
      { name: "jurisdiction", type: "string" },
      { name: "validUntil", type: "uint64" },
      { name: "provider", type: "string" },
    ],
  }),
  AGE_OVER_18: finalize({
    name: "arcpass_age_over18",
    version: "3.0.0",
    fields: [
      { name: "over18", type: "bool" },
      { name: "checkedAt", type: "uint64" },
      { name: "provider", type: "string" },
    ],
  }),
} as const;

// ─── SERVICE 3: Professional Credentials ────────────────────────────────────

export const CREDENTIAL_SCHEMAS = {
  CERTIFICATION: finalize({
    name: "arcpass_certification",
    version: "3.0.0",
    fields: [
      { name: "certName", type: "string" },
      { name: "issuingBody", type: "string" },
      { name: "certId", type: "string" },
      { name: "issuedAt", type: "uint64" },
      { name: "validUntil", type: "uint64" },
    ],
  }),
  LICENSE: finalize({
    name: "arcpass_license",
    version: "3.0.0",
    fields: [
      { name: "licenseType", type: "string" },
      { name: "licenseNumber", type: "string" },
      { name: "jurisdiction", type: "string" },
      { name: "issuingBody", type: "string" },
      { name: "validUntil", type: "uint64" },
    ],
  }),
  SKILL_ENDORSEMENT: finalize({
    name: "arcpass_skill",
    version: "3.0.0",
    fields: [
      { name: "skill", type: "string" },
      { name: "level", type: "uint8" },
      { name: "endorsedBy", type: "address" },
    ],
  }),
} as const;

// ─── SERVICE 4: DAO & Governance ───────────────────────────────────────────

export const DAO_SCHEMAS = {
  DAO_MEMBERSHIP: finalize({
    name: "arcpass_dao_membership",
    version: "3.0.0",
    fields: [
      { name: "daoName", type: "string" },
      { name: "daoAddress", type: "address" },
      { name: "role", type: "string" },
      { name: "joinedAt", type: "uint64" },
      { name: "votingWeight", type: "uint256" },
    ],
  }),
  GOVERNANCE_PARTICIPATION: finalize({
    name: "arcpass_governance_participation",
    version: "3.0.0",
    fields: [
      { name: "daoAddress", type: "address" },
      { name: "proposalsPassed", type: "uint32" },
      { name: "votesParticipated", type: "uint32" },
      { name: "delegatesCount", type: "uint32" },
      { name: "updatedAt", type: "uint64" },
    ],
  }),
  DELEGATE: finalize({
    name: "arcpass_delegate",
    version: "3.0.0",
    fields: [
      { name: "daoAddress", type: "address" },
      { name: "delegatedFrom", type: "address[]" },
      { name: "statement", type: "string" },
    ],
  }),
} as const;

// ─── SERVICE 5: Reputation & Trust Score ────────────────────────────────────

export const REPUTATION_SCHEMAS = {
  REPUTATION_SCORE: finalize({
    name: "arcpass_reputation_score",
    version: "3.0.0",
    fields: [
      { name: "score", type: "uint256" },
      { name: "domain", type: "string" },
      { name: "dataPoints", type: "uint32" },
      { name: "updatedAt", type: "uint64" },
    ],
  }),
  POSITIVE_INTERACTION: finalize({
    name: "arcpass_positive_interaction",
    version: "3.0.0",
    fields: [
      { name: "context", type: "string" },
      { name: "counterparty", type: "address" },
      { name: "platform", type: "string" },
      { name: "occurredAt", type: "uint64" },
    ],
  }),
  DISPUTE_RECORD: finalize({
    name: "arcpass_dispute_record",
    version: "3.0.0",
    fields: [
      { name: "type", type: "string" },
      { name: "reportedBy", type: "address" },
      { name: "evidence", type: "string" },
      { name: "resolvedAt", type: "uint64" },
    ],
  }),
} as const;

// ─── SERVICE 6: Employment & HR ─────────────────────────────────────────────

export const EMPLOYMENT_SCHEMAS = {
  EMPLOYMENT_RECORD: finalize({
    name: "arcpass_employment",
    version: "3.0.0",
    fields: [
      { name: "employer", type: "string" },
      { name: "role", type: "string" },
      { name: "startDate", type: "uint64" },
      { name: "endDate", type: "uint64" },
      { name: "employerDid", type: "string" },
    ],
  }),
  INCOME_BAND: finalize({
    name: "arcpass_income_band",
    version: "3.0.0",
    fields: [
      { name: "currency", type: "string" },
      { name: "bandMin", type: "uint256" },
      { name: "bandMax", type: "uint256" },
      { name: "verifiedAt", type: "uint64" },
      { name: "provider", type: "string" },
    ],
  }),
  CONTRACTOR_RECORD: finalize({
    name: "arcpass_contractor",
    version: "3.0.0",
    fields: [
      { name: "platform", type: "string" },
      { name: "completedJobs", type: "uint32" },
      { name: "totalEarned", type: "uint256" },
      { name: "rating", type: "uint16" },
      { name: "updatedAt", type: "uint64" },
    ],
  }),
} as const;

// ─── SERVICE 7: Education ──────────────────────────────────────────────────

export const EDUCATION_SCHEMAS = {
  DEGREE: finalize({
    name: "arcpass_degree",
    version: "3.0.0",
    fields: [
      { name: "institution", type: "string" },
      { name: "degree", type: "string" },
      { name: "fieldOfStudy", type: "string" },
      { name: "graduationYear", type: "uint16" },
      { name: "institutionDid", type: "string" },
    ],
  }),
  COURSE_COMPLETION: finalize({
    name: "arcpass_course",
    version: "3.0.0",
    fields: [
      { name: "courseName", type: "string" },
      { name: "provider", type: "string" },
      { name: "score", type: "uint8" },
      { name: "completedAt", type: "uint64" },
      { name: "certificateId", type: "string" },
    ],
  }),
  BOOTCAMP_GRADUATE: finalize({
    name: "arcpass_bootcamp",
    version: "3.0.0",
    fields: [
      { name: "bootcamp", type: "string" },
      { name: "track", type: "string" },
      { name: "graduatedAt", type: "uint64" },
      { name: "projectUri", type: "string" },
    ],
  }),
} as const;

// ─── SERVICE 8: Social Verification ────────────────────────────────────────

export const SOCIAL_SCHEMAS = {
  SOCIAL_ACCOUNT: finalize({
    name: "arcpass_social_account",
    version: "3.0.0",
    fields: [
      { name: "platform", type: "string" },
      { name: "handle", type: "string" },
      { name: "profileId", type: "string" },
      { name: "verifiedAt", type: "uint64" },
    ],
  }),
  HUMANITY_PROOF: finalize({
    name: "arcpass_humanity",
    version: "3.0.0",
    fields: [
      { name: "verified", type: "bool" },
      { name: "mechanism", type: "string" },
      { name: "nullifier", type: "bytes32" },
      { name: "checkedAt", type: "uint64" },
    ],
  }),
  FOLLOWER_MILESTONE: finalize({
    name: "arcpass_follower_milestone",
    version: "3.0.0",
    fields: [
      { name: "platform", type: "string" },
      { name: "followerCount", type: "uint32" },
      { name: "milestone", type: "uint32" },
      { name: "verifiedAt", type: "uint64" },
    ],
  }),
} as const;

// ─── SERVICE 9: Custom / Open Registry ──────────────────────────────────────

export const CUSTOM_SCHEMAS = {} as const;

// ─── AGGREGATED EXPORT ─────────────────────────────────────────────────────

export const ALL_SCHEMAS = {
  identity: IDENTITY_SCHEMAS,
  kyc: KYC_SCHEMAS,
  credentials: CREDENTIAL_SCHEMAS,
  dao: DAO_SCHEMAS,
  reputation: REPUTATION_SCHEMAS,
  employment: EMPLOYMENT_SCHEMAS,
  education: EDUCATION_SCHEMAS,
  social: SOCIAL_SCHEMAS,
  custom: CUSTOM_SCHEMAS,
} as const;

export type ServiceKey = keyof typeof ALL_SCHEMAS;

export function getSchemaIds(): { name: string; id: `0x${string}` }[] {
  const ids: { name: string; id: `0x${string}` }[] = [];
  for (const [service, schemas] of Object.entries(ALL_SCHEMAS)) {
    for (const [key, def] of Object.entries(schemas as Record<string, SchemaDefinition>)) {
      if (def.id) ids.push({ name: `${service}.${key}`, id: def.id });
    }
  }
  return ids;
}

export function getSchemaById(id: `0x${string}`): SchemaDefinition | undefined {
  for (const schemas of Object.values(ALL_SCHEMAS)) {
    for (const def of Object.values(schemas as Record<string, SchemaDefinition>)) {
      if (def.id === id) return def;
    }
  }
  return undefined;
}

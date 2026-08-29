import { keccak256, encodePacked } from "viem";

export type FieldClassification = "PUBLIC" | "PRIVATE" | "DERIVED";

export interface SchemaFieldDefinition {
  name: string;
  type: string;
  classification: FieldClassification;
}

export interface SchemaDefinition {
  name: string;
  version: string;
  fields: SchemaFieldDefinition[];
  id?: `0x${string}`;
}

function computeId(name: string, version: string, fieldsJson: string): `0x${string}` {
  return keccak256(encodePacked(["string", "string", "string"], [name, version, fieldsJson]));
}

function fieldsToString(fields: SchemaFieldDefinition[]): string {
  // Strip classification — it is an off-chain concern and must NOT affect the schemaId,
  // which is computed identically on-chain and off-chain.
  return JSON.stringify(fields.map(({ name, type }) => ({ name, type })));
}

function finalize(s: SchemaDefinition): SchemaDefinition {
  return { ...s, id: computeId(s.name, s.version, fieldsToString(s.fields)) };
}

// ─── SERVICE 1: Identity & Passport ────────────────────────────────────────

export const IDENTITY_SCHEMAS = {
  BASIC_IDENTITY: finalize({
    name: "arcpass_identity",
    version: "1.0.0",
    fields: [
      { name: "displayName", type: "string", classification: "PUBLIC" },
      { name: "avatarCid", type: "string", classification: "PUBLIC" },
      { name: "createdAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  LIVENESS_VERIFIED: finalize({
    name: "arcpass_liveness",
    version: "1.0.0",
    fields: [
      { name: "verified", type: "bool", classification: "PUBLIC" },
      { name: "provider", type: "string", classification: "PUBLIC" },
      { name: "checkedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
} as const;

// ─── SERVICE 2: KYC / Compliance ───────────────────────────────────────────

export const KYC_SCHEMAS = {
  KYC_BASIC: finalize({
    name: "arcpass_kyc_basic",
    version: "1.0.0",
    fields: [
      { name: "level", type: "uint8", classification: "PUBLIC" },
      { name: "country", type: "string", classification: "PUBLIC" },
      { name: "provider", type: "string", classification: "PUBLIC" },
      { name: "checkedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  AML_SCREENING: finalize({
    name: "arcpass_aml_screening",
    version: "1.0.0",
    fields: [
      { name: "passed", type: "bool", classification: "PUBLIC" },
      { name: "provider", type: "string", classification: "PUBLIC" },
      { name: "checkedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  ACCREDITED_INVESTOR: finalize({
    name: "arcpass_accredited_investor",
    version: "1.0.0",
    fields: [
      { name: "jurisdiction", type: "string", classification: "PRIVATE" },
      { name: "validUntil", type: "uint64", classification: "PUBLIC" },
      { name: "provider", type: "string", classification: "PUBLIC" },
    ],
  }),
  AGE_OVER_18: finalize({
    name: "arcpass_age_over18",
    version: "1.0.0",
    fields: [
      { name: "over18", type: "bool", classification: "PUBLIC" },
      { name: "checkedAt", type: "uint64", classification: "PUBLIC" },
      { name: "provider", type: "string", classification: "PUBLIC" },
    ],
  }),
} as const;

// ─── SERVICE 3: Professional Credentials ────────────────────────────────────

export const CREDENTIAL_SCHEMAS = {
  CERTIFICATION: finalize({
    name: "arcpass_certification",
    version: "1.0.0",
    fields: [
      { name: "certName", type: "string", classification: "PUBLIC" },
      { name: "issuingBody", type: "string", classification: "PUBLIC" },
      { name: "certId", type: "string", classification: "PRIVATE" },
      { name: "issuedAt", type: "uint64", classification: "PUBLIC" },
      { name: "validUntil", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  LICENSE: finalize({
    name: "arcpass_license",
    version: "1.0.0",
    fields: [
      { name: "licenseType", type: "string", classification: "PUBLIC" },
      { name: "licenseNumber", type: "string", classification: "PRIVATE" },
      { name: "jurisdiction", type: "string", classification: "PRIVATE" },
      { name: "issuingBody", type: "string", classification: "PUBLIC" },
      { name: "validUntil", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  SKILL_ENDORSEMENT: finalize({
    name: "arcpass_skill",
    version: "1.0.0",
    fields: [
      { name: "skill", type: "string", classification: "PUBLIC" },
      { name: "level", type: "uint8", classification: "PUBLIC" },
      { name: "endorsedBy", type: "address", classification: "PUBLIC" },
    ],
  }),
} as const;

// ─── SERVICE 4: DAO & Governance ───────────────────────────────────────────

export const DAO_SCHEMAS = {
  DAO_MEMBERSHIP: finalize({
    name: "arcpass_dao_membership",
    version: "1.0.0",
    fields: [
      { name: "daoName", type: "string", classification: "PUBLIC" },
      { name: "daoAddress", type: "address", classification: "PUBLIC" },
      { name: "role", type: "string", classification: "PUBLIC" },
      { name: "joinedAt", type: "uint64", classification: "PUBLIC" },
      { name: "votingWeight", type: "uint256", classification: "PRIVATE" },
    ],
  }),
  GOVERNANCE_PARTICIPATION: finalize({
    name: "arcpass_governance_participation",
    version: "1.0.0",
    fields: [
      { name: "daoAddress", type: "address", classification: "PUBLIC" },
      { name: "proposalsPassed", type: "uint32", classification: "PUBLIC" },
      { name: "votesParticipated", type: "uint32", classification: "PUBLIC" },
      { name: "delegatesCount", type: "uint32", classification: "PUBLIC" },
      { name: "updatedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  DELEGATE: finalize({
    name: "arcpass_delegate",
    version: "1.0.0",
    fields: [
      { name: "daoAddress", type: "address", classification: "PUBLIC" },
      { name: "delegatedFrom", type: "address[]", classification: "PRIVATE" },
      { name: "statement", type: "string", classification: "PUBLIC" },
    ],
  }),
} as const;

// ─── SERVICE 5: Reputation & Trust Score ────────────────────────────────────

export const REPUTATION_SCHEMAS = {
  REPUTATION_SCORE: finalize({
    name: "arcpass_reputation_score",
    version: "1.0.0",
    fields: [
      { name: "score", type: "uint256", classification: "PRIVATE" },
      { name: "domain", type: "string", classification: "PUBLIC" },
      { name: "dataPoints", type: "uint32", classification: "PUBLIC" },
      { name: "updatedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  POSITIVE_INTERACTION: finalize({
    name: "arcpass_positive_interaction",
    version: "1.0.0",
    fields: [
      { name: "context", type: "string", classification: "PUBLIC" },
      { name: "counterparty", type: "address", classification: "PRIVATE" },
      { name: "platform", type: "string", classification: "PUBLIC" },
      { name: "occurredAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  DISPUTE_RECORD: finalize({
    name: "arcpass_dispute_record",
    version: "1.0.0",
    fields: [
      { name: "type", type: "string", classification: "PRIVATE" },
      { name: "reportedBy", type: "address", classification: "PRIVATE" },
      { name: "evidence", type: "string", classification: "PRIVATE" },
      { name: "resolvedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
} as const;

// ─── SERVICE 6: Employment & HR ─────────────────────────────────────────────

export const EMPLOYMENT_SCHEMAS = {
  EMPLOYMENT_RECORD: finalize({
    name: "arcpass_employment",
    version: "1.0.0",
    fields: [
      { name: "employer", type: "string", classification: "PUBLIC" },
      { name: "role", type: "string", classification: "PUBLIC" },
      { name: "startDate", type: "uint64", classification: "PUBLIC" },
      { name: "endDate", type: "uint64", classification: "PUBLIC" },
      { name: "employerDid", type: "string", classification: "PRIVATE" },
    ],
  }),
  INCOME_BAND: finalize({
    name: "arcpass_income_band",
    version: "1.0.0",
    fields: [
      { name: "currency", type: "string", classification: "PUBLIC" },
      { name: "bandMin", type: "uint256", classification: "PRIVATE" },
      { name: "bandMax", type: "uint256", classification: "PRIVATE" },
      { name: "verifiedAt", type: "uint64", classification: "PUBLIC" },
      { name: "provider", type: "string", classification: "PUBLIC" },
    ],
  }),
  CONTRACTOR_RECORD: finalize({
    name: "arcpass_contractor",
    version: "1.0.0",
    fields: [
      { name: "platform", type: "string", classification: "PUBLIC" },
      { name: "completedJobs", type: "uint32", classification: "PUBLIC" },
      { name: "totalEarned", type: "uint256", classification: "PRIVATE" },
      { name: "rating", type: "uint16", classification: "PUBLIC" },
      { name: "updatedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
} as const;

// ─── SERVICE 7: Education ──────────────────────────────────────────────────

export const EDUCATION_SCHEMAS = {
  DEGREE: finalize({
    name: "arcpass_degree",
    version: "1.0.0",
    fields: [
      { name: "institution", type: "string", classification: "PUBLIC" },
      { name: "degree", type: "string", classification: "PUBLIC" },
      { name: "fieldOfStudy", type: "string", classification: "PUBLIC" },
      { name: "graduationYear", type: "uint16", classification: "PUBLIC" },
      { name: "institutionDid", type: "string", classification: "PRIVATE" },
    ],
  }),
  COURSE_COMPLETION: finalize({
    name: "arcpass_course",
    version: "1.0.0",
    fields: [
      { name: "courseName", type: "string", classification: "PUBLIC" },
      { name: "provider", type: "string", classification: "PUBLIC" },
      { name: "score", type: "uint8", classification: "PRIVATE" },
      { name: "completedAt", type: "uint64", classification: "PUBLIC" },
      { name: "certificateId", type: "string", classification: "PRIVATE" },
    ],
  }),
  BOOTCAMP_GRADUATE: finalize({
    name: "arcpass_bootcamp",
    version: "1.0.0",
    fields: [
      { name: "bootcamp", type: "string", classification: "PUBLIC" },
      { name: "track", type: "string", classification: "PUBLIC" },
      { name: "graduatedAt", type: "uint64", classification: "PUBLIC" },
      { name: "projectUri", type: "string", classification: "PUBLIC" },
    ],
  }),
} as const;

// ─── SERVICE 8: Social Verification ────────────────────────────────────────

export const SOCIAL_SCHEMAS = {
  SOCIAL_ACCOUNT: finalize({
    name: "arcpass_social_account",
    version: "1.0.0",
    fields: [
      { name: "platform", type: "string", classification: "PUBLIC" },
      { name: "handle", type: "string", classification: "PUBLIC" },
      { name: "profileId", type: "string", classification: "PRIVATE" },
      { name: "verifiedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  HUMANITY_PROOF: finalize({
    name: "arcpass_humanity",
    version: "1.0.0",
    fields: [
      { name: "verified", type: "bool", classification: "PUBLIC" },
      { name: "mechanism", type: "string", classification: "PUBLIC" },
      { name: "nullifier", type: "bytes32", classification: "PRIVATE" },
      { name: "checkedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  FOLLOWER_MILESTONE: finalize({
    name: "arcpass_follower_milestone",
    version: "1.0.0",
    fields: [
      { name: "platform", type: "string", classification: "PUBLIC" },
      { name: "followerCount", type: "uint32", classification: "PUBLIC" },
      { name: "milestone", type: "uint32", classification: "PUBLIC" },
      { name: "verifiedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  WEB2_DATA_PROOF: finalize({
    name: "arcpass_web2_data_proof",
    version: "1.0.0",
    fields: [
      { name: "verified", type: "bool", classification: "PUBLIC" },
      { name: "provider", type: "string", classification: "PUBLIC" },
      { name: "templateId", type: "string", classification: "PUBLIC" },
      { name: "dataHash", type: "bytes32", classification: "PRIVATE" },
      { name: "checkedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  OPENID3_IDENTITY: finalize({
    name: "arcpass_openid3_identity",
    version: "1.0.0",
    fields: [
      { name: "linked", type: "bool", classification: "PUBLIC" },
      { name: "provider", type: "string", classification: "PUBLIC" },
      { name: "accountHandle", type: "string", classification: "PUBLIC" },
      { name: "accountVerified", type: "bool", classification: "PUBLIC" },
      { name: "linkedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
} as const;

// ─── SERVICE 9: Custom / Open Registry ──────────────────────────────────────

export const CUSTOM_SCHEMAS = {} as const;

// ─── SERVICE 10: ZK Passport ────────────────────────────────────────────────

export const ZK_PASSPORT_SCHEMAS = {
  PASSPORT_AUTHENTICITY: finalize({
    name: "arcpass_passport_authenticity",
    version: "1.0.0",
    fields: [
      { name: "documentType", type: "string", classification: "PUBLIC" },
      { name: "issuerCountry", type: "string", classification: "PRIVATE" },
      { name: "issuingAuthority", type: "string", classification: "PRIVATE" },
      { name: "documentNumber", type: "string", classification: "PRIVATE" },
      { name: "issuedAt", type: "uint64", classification: "PUBLIC" },
      { name: "expiresAt", type: "uint64", classification: "PUBLIC" },
      { name: "verified", type: "bool", classification: "PUBLIC" },
      { name: "proofHash", type: "bytes32", classification: "PRIVATE" },
    ],
  }),
  ZK_ATTRIBUTE_PROOF: finalize({
    name: "arcpass_zk_attribute_proof",
    version: "1.0.0",
    fields: [
      { name: "attributeType", type: "string", classification: "PUBLIC" },
      { name: "attributeHash", type: "bytes32", classification: "PRIVATE" },
      { name: "circuitId", type: "string", classification: "PUBLIC" },
      { name: "verified", type: "bool", classification: "PUBLIC" },
      { name: "proofHash", type: "bytes32", classification: "PRIVATE" },
      { name: "verifiedAt", type: "uint64", classification: "PUBLIC" },
    ],
  }),
  NFC_PASSPORT_SCAN: finalize({
    name: "arcpass_nfc_passport_scan",
    version: "1.0.0",
    fields: [
      { name: "scanProvider", type: "string", classification: "PUBLIC" },
      { name: "documentType", type: "string", classification: "PUBLIC" },
      { name: "countryCode", type: "string", classification: "PRIVATE" },
      { name: "chipVerified", type: "bool", classification: "PUBLIC" },
      { name: "signatureValid", type: "bool", classification: "PUBLIC" },
      { name: "livenessPassed", type: "bool", classification: "PUBLIC" },
      { name: "scannedAt", type: "uint64", classification: "PUBLIC" },
      { name: "nullifier", type: "bytes32", classification: "PRIVATE" },
    ],
  }),
} as const;

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
  zkPassport: ZK_PASSPORT_SCHEMAS,
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

/** Maps schemaId (lowercase) → service key for fast lookups. */
export const SCHEMA_ID_TO_SERVICE: Record<string, ServiceKey> = {};
for (const [service, schemas] of Object.entries(ALL_SCHEMAS)) {
  for (const def of Object.values(schemas as Record<string, SchemaDefinition>)) {
    if (def.id) SCHEMA_ID_TO_SERVICE[def.id.toLowerCase()] = service as ServiceKey;
  }
}

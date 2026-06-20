import type { ServiceKey } from "../../types/passport";
import type { FieldDef } from "./FieldBuilder";

export interface SchemaTemplate {
  name:        string;
  version:     string;
  description: string;
  fields:      FieldDef[];
}

const BASIC_IDENTITY_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_identity",
  version:     "3.0.0",
  description: "Basic identity record (display name + avatar)",
  fields: [
    { name: "displayName", type: "string" },
    { name: "avatarCid",   type: "string" },
    { name: "createdAt",   type: "uint64" },
  ],
};

const LIVENESS_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_liveness",
  version:     "3.0.0",
  description: "Liveness verification (boolean result + provider)",
  fields: [
    { name: "verified",  type: "bool"   },
    { name: "provider",  type: "string" },
    { name: "checkedAt", type: "uint64" },
  ],
};

const KYC_BASIC_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_kyc_basic",
  version:     "3.0.0",
  description: "Tier 1 KYC: name + country confirmed",
  fields: [
    { name: "level",     type: "uint8"  },
    { name: "country",   type: "string" },
    { name: "provider",  type: "string" },
    { name: "checkedAt", type: "uint64" },
  ],
};

const AML_SCREENING_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_aml_screening",
  version:     "3.0.0",
  description: "AML / sanctions screening result",
  fields: [
    { name: "passed",    type: "bool"   },
    { name: "provider",  type: "string" },
    { name: "checkedAt", type: "uint64" },
  ],
};

const AGE_OVER_18_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_age_over18",
  version:     "3.0.0",
  description: "Privacy-preserving age gate (boolean only)",
  fields: [
    { name: "over18",    type: "bool"   },
    { name: "checkedAt", type: "uint64" },
    { name: "provider",  type: "string" },
  ],
};

const CERTIFICATION_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_certification",
  version:     "3.0.0",
  description: "Generic professional certification",
  fields: [
    { name: "certName",    type: "string" },
    { name: "issuingBody", type: "string" },
    { name: "certId",      type: "string" },
    { name: "issuedAt",    type: "uint64" },
    { name: "validUntil",  type: "uint64" },
  ],
};

const SKILL_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_skill",
  version:     "3.0.0",
  description: "Peer skill endorsement (level 1-3)",
  fields: [
    { name: "skill",      type: "string"  },
    { name: "level",      type: "uint8"   },
    { name: "endorsedBy", type: "address" },
  ],
};

const DAO_MEMBERSHIP_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_dao_membership",
  version:     "3.0.0",
  description: "DAO membership record with role + voting weight",
  fields: [
    { name: "daoName",      type: "string"  },
    { name: "daoAddress",   type: "address" },
    { name: "role",         type: "string"  },
    { name: "joinedAt",     type: "uint64"  },
    { name: "votingWeight", type: "uint256" },
  ],
};

const REPUTATION_SCORE_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_reputation_score",
  version:     "3.0.0",
  description: "Aggregate reputation score (0-10000 basis points)",
  fields: [
    { name: "score",      type: "uint256" },
    { name: "domain",     type: "string"  },
    { name: "dataPoints", type: "uint32"  },
    { name: "updatedAt",  type: "uint64"  },
  ],
};

const EMPLOYMENT_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_employment",
  version:     "3.0.0",
  description: "Employment record (employer + role + dates)",
  fields: [
    { name: "employer",    type: "string" },
    { name: "role",        type: "string" },
    { name: "startDate",   type: "uint64" },
    { name: "endDate",     type: "uint64" },
    { name: "employerDid", type: "string" },
  ],
};

const DEGREE_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_degree",
  version:     "3.0.0",
  description: "Academic degree",
  fields: [
    { name: "institution",    type: "string" },
    { name: "degree",         type: "string" },
    { name: "fieldOfStudy",   type: "string" },
    { name: "graduationYear", type: "uint16" },
  ],
};

const SOCIAL_ACCOUNT_TEMPLATE: SchemaTemplate = {
  name:        "arcpass_social_account",
  version:     "3.0.0",
  description: "Social account link (no PII on-chain)",
  fields: [
    { name: "platform",   type: "string" },
    { name: "handle",     type: "string" },
    { name: "profileId",  type: "string" },
    { name: "verifiedAt", type: "uint64" },
  ],
};

export const SCHEMA_TEMPLATES: Record<ServiceKey, SchemaTemplate[]> = {
  identity:    [BASIC_IDENTITY_TEMPLATE, LIVENESS_TEMPLATE],
  kyc:         [KYC_BASIC_TEMPLATE, AML_SCREENING_TEMPLATE, AGE_OVER_18_TEMPLATE],
  credentials: [CERTIFICATION_TEMPLATE, SKILL_TEMPLATE],
  dao:         [DAO_MEMBERSHIP_TEMPLATE],
  reputation:  [REPUTATION_SCORE_TEMPLATE],
  employment:  [EMPLOYMENT_TEMPLATE],
  education:   [DEGREE_TEMPLATE],
  social:      [SOCIAL_ACCOUNT_TEMPLATE],
  custom:      [],
};

export type ServiceKey =
  | "identity" | "kyc" | "credentials" | "dao"
  | "reputation" | "employment" | "education" | "social" | "custom"
  | "zkPassport";

export interface ActiveClaim {
  claimId:  string;
  schemaId: string;
  issuer:   string;
  valid:    boolean;
}

export interface IdentityMetadata {
  arcpass_version: string;
  type:            "identity";
  name:            string;
  description?:    string;
  image?:          string;
  created_at:      string;
  attributes:      { trait_type: string; value: string | number }[];
}

export interface ReputationEvent {
  eventId:       number;
  eventType?:    string;
  metadataUri?:  string;
}

export interface ServiceClaims {
  service:    ServiceKey;
  claims:     ActiveClaim[];
  verified:   boolean;
  claimCount: number;
}

export interface CategoryScore {
  service:       ServiceKey;
  label:         string;
  weight:        number;
  claimCount:    number;
  uniqueIssuers: number;
  score:         number;
  maxPossible:   number;
}

export interface TrustScore {
  score:           number;
  passed:          boolean;
  threshold:       number;
  categories:      CategoryScore[];
  totalClaims:     number;
  totalIssuers:    number;
  activeCategories: ServiceKey[];
  computedAt:      number;
  policyVersion:   string;
}

export interface PassportDocument {
  address:      string;
  identityId:   number;
  metadataUri:  string | null;
  metadata:     IdentityMetadata | null;
  reputation:   ReputationEvent[];
  claims:       ActiveClaim[];
  services:     Record<ServiceKey, ServiceClaims>;
  trustScore:   TrustScore;
  onChainScore: OnChainScore | null;
  generatedAt:  number;
}

export interface OnChainScore {
  score:           number;
  isValid:         boolean;
  isHuman:         boolean;
  computedAt:      number;
  expiresAt:       number;
  dataCommitment:  string;
}

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  identity:    "Identity & Passport",
  kyc:         "KYC / Compliance",
  credentials: "Professional Credentials",
  dao:         "DAO & Governance",
  reputation:  "Reputation & Trust",
  employment:  "Employment & HR",
  education:   "Education",
  social:      "Social Verification",
  custom:      "Custom / Open",
  zkPassport:  "ZK Passport",
};

export const ALL_SERVICE_KEYS: ServiceKey[] = [
  "identity", "kyc", "credentials", "dao",
  "reputation", "employment", "education", "social", "custom",
  "zkPassport",
];

export type ServiceKey =
  | "identity" | "kyc" | "credentials" | "dao"
  | "reputation" | "employment" | "education" | "social" | "custom";

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
};

export const ALL_SERVICE_KEYS: ServiceKey[] = [
  "identity", "kyc", "credentials", "dao",
  "reputation", "employment", "education", "social", "custom",
];

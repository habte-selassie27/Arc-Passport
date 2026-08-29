export interface ActiveClaim {
  claimId:  string;
  schemaId: string;
  issuer:   string;
  valid:    boolean;
  /** True when batch validation failed (RPC timeout / error) — claim may be valid on-chain. */
  validationFailed?: boolean;
}

export interface ServiceClaims {
  service:    string;
  claims:     ActiveClaim[];
  verified:   boolean;
  claimCount: number;
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
  eventId:    number;
  eventType?: string;
  metadataUri?: string;
}

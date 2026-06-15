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
  eventId:    number;
  eventType?: string;
  metadataUri?: string;
}

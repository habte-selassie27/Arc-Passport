export interface Identity {
  tokenId: number;
  metadataUri: string;
}

export interface IdentityMetadata {
  arcpass_version: string;
  type: "identity";
  name: string;
  description?: string;
  image?: string;
  created_at: string;
  attributes?: { trait_type: string; value: string | number }[];
}

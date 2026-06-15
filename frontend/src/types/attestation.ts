export interface Claim {
  claimId: `0x${string}`;
  subject: `0x${string}`;
  schemaId: `0x${string}`;
  issuer: `0x${string}`;
  dataCommitment: `0x${string}`;
  issuedAt: bigint;
  expiresAt: bigint;
  revoked: boolean;
}

export interface Schema {
  schemaId: `0x${string}`;
  name: string;
  version: string;
  fieldsJson: string;
  registrant: `0x${string}`;
  registeredAt: bigint;
}

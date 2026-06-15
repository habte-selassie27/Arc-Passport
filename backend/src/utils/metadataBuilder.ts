import { z } from "zod";

const IdentityMetadataSchema = z.object({
  arcpass_version: z.literal("1.0"),
  type: z.literal("identity"),
  name: z.string().max(100).regex(/^[\w\s\-\.]+$/),
  description: z.string().max(500).optional(),
  image: z.string().startsWith("ipfs://").optional(),
  created_at: z.string().datetime(),
  attributes: z
    .array(
      z.object({
        trait_type: z.string().max(50),
        value: z.union([z.string().max(200), z.number()]),
      })
    )
    .max(20)
    .optional(),
});

const AttestationMetadataSchema = z.object({
  arcpass_version: z.literal("1.0"),
  type: z.literal("attestation"),
  claimId: z.string(),
  schemaId: z.string(),
  schemaName: z.string(),
  issuedAt: z.number(),
  expiresAt: z.number(),
  publicFields: z.record(z.unknown()).optional(),
});

export function validateAndBuildIdentityMetadata(raw: unknown) {
  return IdentityMetadataSchema.parse(raw);
}

export function validateAndBuildAttestationMetadata(raw: unknown) {
  return AttestationMetadataSchema.parse(raw);
}

/**
 * Shared zod schemas for all v1 routes.
 *
 * These schemas are the single source of truth for both:
 *   1. Runtime request validation in the v1 route files
 *   2. OpenAPI 3.1 spec generation in src/openapi/registry.ts
 *
 * Every schema is decorated with `.openapi()` so it can be registered
 * as a component in the OpenAPI document.
 */
import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ─── Common primitives ────────────────────────────────────────────────────

const addressLike = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 20-byte address")
  .openapi({
    param: { name: "address", in: "path" },
    example: "0x0000000000000000000000000000000000000001",
  });

const schemaIdHex = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "must be a 0x-prefixed 32-byte hex schema ID")
  .openapi({ example: "0x914820eb9dcaff70fbd600b5578150c943ccb15ae59d8ba46dfc21dcf4f4ab6b" });

const cid = z
  .string()
  .regex(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafkrei[a-z0-9]{50,}|)$/, "must be empty or valid IPFS CID")
  .openapi({ example: "bafkreid7qoywn77x6z4cjf4qaufluv6ez3ypxnvdxw4rk5x7v5wq2xk7zu" });

const isoCountry = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, "must be 2-letter ISO-3166-1 alpha-2")
  .openapi({ example: "US" });

// ─── Standard response envelopes ─────────────────────────────────────────

export const ErrorResponse = z
  .object({
    success: z.literal(false),
    error: z.object({
      code:    z.string().openapi({ example: "MISSING_FIELDS" }),
      message: z.string().openapi({ example: "subject and level required" }),
      context: z.record(z.string(), z.unknown()).optional(),
    }),
  })
  .openapi("ErrorResponse");

export const TxResponse = z
  .object({
    success: z.literal(true),
    data: z.object({
      txHash: z.string().openapi({ example: "0xabc...123" }),
    }),
  })
  .openapi("TxResponse");

export const SimpleResponse = z
  .object({
    success: z.literal(true),
    data: z.object({}).passthrough().openapi({ description: "Service-specific data" }),
  })
  .openapi("SimpleResponse");

// ─── 1. Identity ──────────────────────────────────────────────────────────

export const RegisterIdentityBody = z
  .object({
    subject:     addressLike,
    displayName: z.string().min(1).max(64).openapi({ example: "Ada Lovelace" }),
    avatarCid:   cid.optional(),
    expiresAt:   z.number().int().nonnegative().optional().openapi({ example: 1893456000 }),
  })
  .openapi("RegisterIdentityBody");

export const LivenessBody = z
  .object({
    subject:  addressLike,
    verified: z.boolean(),
    provider: z.string().min(1).max(64).openapi({ example: "jumio" }),
    expiresAt: z.number().int().nonnegative().optional(),
  })
  .openapi("LivenessBody");

// ─── 2. KYC ───────────────────────────────────────────────────────────────

export const BasicKycBody = z
  .object({
    subject:   addressLike,
    level:     z.number().int().min(0).max(3).openapi({ description: "KYC level: 0=none, 1=basic, 2=enhanced, 3=institutional" }),
    country:   isoCountry.default("US"),
    provider:  z.string().max(64).default("self").openapi({ example: "jumio" }),
    expiresAt: z.number().int().nonnegative().optional(),
  })
  .openapi("BasicKycBody");

export const AmlBody = z
  .object({
    subject:  addressLike,
    passed:   z.boolean(),
    provider: z.string().min(1).max(64).default("chainalysis"),
  })
  .openapi("AmlBody");

export const AccreditedBody = z
  .object({
    subject:      addressLike,
    jurisdiction: isoCountry,
    validUntil:   z.number().int().positive().openapi({ description: "Unix seconds" }),
    provider:     z.string().min(1).max(64).default("verifyinvestor"),
  })
  .openapi("AccreditedBody");

export const AgeGateBody = z
  .object({
    subject:  addressLike,
    over18:   z.boolean().refine((v) => v === true, "must be true"),
    provider: z.string().min(1).max(64).default("jumio"),
  })
  .openapi("AgeGateBody");

// ─── 3. Credentials ──────────────────────────────────────────────────────

export const CertifyBody = z
  .object({
    subject:     addressLike,
    certName:    z.string().min(1).max(128).openapi({ example: "AWS Solutions Architect" }),
    issuingBody: z.string().min(1).max(128).default(""),
    certId:      z.string().max(64).default(""),
    validUntil:  z.number().int().nonnegative().optional(),
  })
  .openapi("CertifyBody");

export const LicenseBody = z
  .object({
    subject:       addressLike,
    licenseType:   z.string().min(1).max(64).openapi({ example: "medical" }),
    licenseNumber: z.string().min(1).max(64).openapi({ example: "MD-12345" }),
    jurisdiction:  isoCountry.default("US"),
    issuingBody:   z.string().min(1).max(128).default(""),
    validUntil:    z.number().int().nonnegative().optional(),
  })
  .openapi("LicenseBody");

export const EndorseBody = z
  .object({
    subject:    addressLike,
    skill:      z.string().min(1).max(64).openapi({ example: "Solidity" }),
    level:      z.number().int().min(0).max(10),
    endorsedBy: addressLike.optional(),
  })
  .openapi("EndorseBody");

// ─── 4. DAO ───────────────────────────────────────────────────────────────

const daoRole = z.enum(["member", "delegate", "contributor", "core", "founder", "admin"]);
const bigish = z.union([z.number(), z.string(), z.bigint()]).transform((v) => BigInt(v));

export const EnrollBody = z
  .object({
    subject:      addressLike,
    daoName:      z.string().min(1).max(64).openapi({ example: "Uniswap" }),
    daoAddress:   addressLike,
    role:         daoRole,
    votingWeight: bigish.optional(),
  })
  .openapi("EnrollBody");

export const ParticipationBody = z
  .object({
    subject:           addressLike,
    daoAddress:        addressLike,
    proposalsPassed:   z.number().int().min(0).default(0),
    votesParticipated: z.number().int().min(0).default(0),
    delegatesCount:    z.number().int().min(0).default(0),
  })
  .openapi("ParticipationBody");

export const DelegateBody = z
  .object({
    subject:       addressLike,
    daoAddress:    addressLike,
    delegatedFrom: z.array(addressLike).min(1).max(1000).openapi({ description: "Addresses that delegated voting power to subject" }),
    statement:     z.string().max(280).default(""),
  })
  .openapi("DelegateBody");

// ─── 5. Reputation ───────────────────────────────────────────────────────

export const RecordReputationBody = z
  .object({
    subject:    addressLike,
    score:      bigish,
    domain:     z.string().min(1).max(64).openapi({ example: "defi" }),
    dataPoints: z.number().int().min(1).max(10000).default(1),
    expiresAt:  z.number().int().nonnegative().optional(),
  })
  .openapi("RecordReputationBody");

export const InteractionBody = z
  .object({
    subject:      addressLike,
    context:      z.string().min(1).max(64).openapi({ example: "swap" }),
    counterparty: addressLike,
    platform:     z.string().min(1).max(64).openapi({ example: "uniswap" }),
  })
  .openapi("InteractionBody");

export const DisputeBody = z
  .object({
    subject:    addressLike,
    type:       z.enum(["fraud", "spam", "abuse", "impersonation", "other"]),
    reportedBy: addressLike,
    evidence:   z.string().max(2048).default(""),
    resolvedAt: z.number().int().nonnegative().default(0),
  })
  .openapi("DisputeBody");

// ─── 6. Employment ───────────────────────────────────────────────────────

export const IssueEmploymentBody = z
  .object({
    subject:     addressLike,
    employer:    z.string().min(1).max(128).openapi({ example: "Acme Corp" }),
    role:        z.string().min(1).max(128).openapi({ example: "Senior Engineer" }),
    startDate:   z.number().int().positive().openapi({ description: "Unix seconds" }),
    endDate:     z.number().int().nonnegative().default(0),
    employerDid: z.string().min(1).max(128).default(""),
  })
  .openapi("IssueEmploymentBody");

export const IncomeBody = z
  .object({
    subject:   addressLike,
    currency:  z.enum(["USD", "EUR", "GBP", "USDC", "EURC", "ETH"]),
    bandMin:   bigish,
    bandMax:   bigish,
    provider:  z.string().min(1).max(64).default("plaid"),
    expiresAt: z.number().int().nonnegative().optional(),
  })
  .refine((d) => d.bandMax >= d.bandMin, { message: "bandMax must be >= bandMin", path: ["bandMax"] })
  .openapi("IncomeBody");

export const ContractorBody = z
  .object({
    subject:       addressLike,
    platform:      z.string().min(1).max(64).openapi({ example: "upwork" }),
    completedJobs: z.number().int().min(0),
    totalEarned:   bigish,
    rating:        z.number().int().min(0).max(500).default(0).openapi({ description: "Rating × 100, so 450 = 4.50 stars" }),
  })
  .openapi("ContractorBody");

// ─── 7. Education ────────────────────────────────────────────────────────

export const DegreeBody = z
  .object({
    subject:        addressLike,
    institution:    z.string().min(1).max(128).openapi({ example: "MIT" }),
    degree:         z.string().min(1).max(64).openapi({ example: "BS" }),
    fieldOfStudy:   z.string().min(1).max(64).default("").openapi({ example: "Computer Science" }),
    graduationYear: z.number().int().min(1900).max(2100),
  })
  .openapi("DegreeBody");

export const CourseBody = z
  .object({
    subject:       addressLike,
    courseName:    z.string().min(1).max(128).openapi({ example: "Solidity 101" }),
    provider:      z.string().min(1).max(64).openapi({ example: "Coursera" }),
    score:         z.number().int().min(0).max(100).default(0),
    certificateId: z.string().max(64).default(""),
  })
  .openapi("CourseBody");

export const BootcampBody = z
  .object({
    subject:    addressLike,
    bootcamp:   z.string().min(1).max(128).openapi({ example: "ChainShot" }),
    track:      z.string().min(1).max(64).openapi({ example: "smart-contracts" }),
    projectUri: cid.optional(),
  })
  .openapi("BootcampBody");

// ─── 8. Social ───────────────────────────────────────────────────────────

const socialPlatform = z.enum(["twitter", "github", "discord", "telegram", "farcaster", "lens", "ens", "ensname", "other"]);
const humanityMechanism = z.enum(["worldcoin", "brightid", "idena", "proof-of-personhood", "civic"]);
const nullifierHex = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "must be 0x-prefixed 32-byte hex");

export const LinkAccountBody = z
  .object({
    subject:   addressLike,
    platform:  socialPlatform,
    handle:    z.string().min(1).max(64).openapi({ example: "0x_intern" }),
    profileId: z.string().max(64).default(""),
    expiresAt: z.number().int().nonnegative().optional(),
  })
  .openapi("LinkAccountBody");

export const HumanityBody = z
  .object({
    subject:   addressLike,
    verified:  z.literal(true),
    mechanism: humanityMechanism,
    nullifier: nullifierHex,
  })
  .openapi("HumanityBody");

export const FollowerMilestoneBody = z
  .object({
    subject:       addressLike,
    platform:      socialPlatform,
    followerCount: z.number().int().min(0),
    milestone:     z.number().int().min(0).max(1_000_000_000).default(0),
  })
  .openapi("FollowerMilestoneBody");

// ─── 9. Custom ───────────────────────────────────────────────────────────

export const RegisterSchemaBody = z
  .object({
    name:       z.string().min(1).max(64).regex(/^[A-Za-z0-9_\-]+$/, "alphanumeric, underscore, hyphen only"),
    version:    z.string().min(1).max(16).regex(/^\d+\.\d+\.\d+$/, "must be semver").openapi({ example: "1.0.0" }),
    fieldsJson: z.string().min(1).max(8192),
  })
  .openapi("RegisterSchemaBody");

export const CustomAttestBody = z
  .object({
    subject:   addressLike,
    schemaId:  schemaIdHex,
    data:      z.string().regex(/^0x[a-fA-F0-9]*$/, "must be 0x-prefixed hex bytes").max(8192),
    expiresAt: z.number().int().nonnegative().optional(),
  })
  .openapi("CustomAttestBody");

// ─── Bulk ────────────────────────────────────────────────────────────────

const ALL_SERVICE_KEYS = ["identity", "kyc", "credentials", "dao", "reputation", "employment", "education", "social", "custom"] as const;

export const BulkJsonBody = z
  .object({
    service: z.enum(ALL_SERVICE_KEYS),
    items:   z.array(z.record(z.string(), z.unknown())).min(1).max(100).openapi({ description: "Pre-validated service-specific row objects" }),
    mode:    z.enum(["batch", "perItem"]).default("perItem").openapi({ description: "batch = single onchain tx (faster, all-or-nothing); perItem = sequential with row-level errors" }),
  })
  .openapi("BulkJsonBody");

export const BulkCsvBody = z
  .object({
    service: z.enum(ALL_SERVICE_KEYS),
    csv:     z.string().min(1).max(1_048_576).openapi({ description: "RFC-4180 CSV with header row" }),
    mode:    z.enum(["batch", "perItem"]).default("perItem"),
  })
  .openapi("BulkCsvBody");

export const BulkResponseData = z
  .object({
    success:   z.literal(true),
    service:   z.enum(ALL_SERVICE_KEYS),
    mode:      z.enum(["batch", "perItem"]),
    total:     z.number().int().min(0),
    succeeded: z.number().int().min(0),
    failed:    z.number().int().min(0),
    results:   z.array(
      z.object({
        index:   z.number().int(),
        success: z.boolean(),
        txHash:  z.string().optional(),
        error:   z.string().optional(),
        message: z.string().optional(),
      })
    ),
    errors: z.array(
      z.object({
        row:   z.number().int(),
        field: z.string().optional(),
        error: z.string(),
      })
    ),
  })
  .openapi("BulkResponseData");

// ─── ServiceKey enum (re-exported for use in tag metadata) ──────────────

export const ServiceKey = z.enum(ALL_SERVICE_KEYS).openapi("ServiceKey");

/**
 * OpenAPI 3.1 spec generator for ArcPass v1.
 *
 * Imports the same zod schemas used for runtime validation (so the spec
 * can never drift from what the routes actually accept), and registers
 * every v1 route with its method, tags, summary, request body schema, and
 * response schema.
 *
 * Exported as `buildOpenApiDocument()` which is called by GET /v1/openapi.json.
 */
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  ErrorResponse, TxResponse, SimpleResponse,
  RegisterIdentityBody, LivenessBody,
  BasicKycBody, AmlBody, AccreditedBody, AgeGateBody,
  CertifyBody, LicenseBody, EndorseBody,
  EnrollBody, ParticipationBody, DelegateBody,
  RecordReputationBody, InteractionBody, DisputeBody,
  IssueEmploymentBody, IncomeBody, ContractorBody,
  DegreeBody, CourseBody, BootcampBody,
  LinkAccountBody, HumanityBody, FollowerMilestoneBody,
  RegisterSchemaBody, CustomAttestBody,
  BulkJsonBody, BulkCsvBody, BulkResponseData,
  ServiceKey,
} from "./schemas.js";

const registry = new OpenAPIRegistry();

// ─── Common error responses registered as component responses ────────────

const BAD_REQUEST = { description: "Validation error", content: { "application/json": { schema: ErrorResponse } } };
const UNAUTHORIZED = { description: "Missing or invalid signature", content: { "application/json": { schema: ErrorResponse } } };
const SERVICE_UNAVAILABLE = { description: "Issuer wallet not configured", content: { "application/json": { schema: ErrorResponse } } };
const INTERNAL_ERROR = { description: "Internal error", content: { "application/json": { schema: ErrorResponse } } };

// ─── Tag metadata ────────────────────────────────────────────────────────

const TAGS = {
  identity:    "Identity",
  kyc:         "KYC / Compliance",
  credentials: "Credentials",
  dao:         "DAO",
  reputation:  "Reputation",
  employment:  "Employment",
  education:   "Education",
  social:      "Social",
  custom:      "Custom Schemas",
  bulk:        "Bulk Operations",
  passport:    "Passport",
} as const;

// ─── Path registration helper ────────────────────────────────────────────

function regPost(path: string, summary: string, tag: string, body: z.ZodTypeAny, responses: Record<number, { description: string; content?: { "application/json": { schema: z.ZodTypeAny } } }> = {}) {
  registry.registerPath({
    method: "post",
    path,
    summary,
    tags: [TAGS[tag as keyof typeof TAGS] ?? tag],
    request: { body: { content: { "application/json": { schema: body } } } },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: TxResponse } } },
      400: BAD_REQUEST,
      401: UNAUTHORIZED,
      500: INTERNAL_ERROR,
      503: SERVICE_UNAVAILABLE,
      ...responses,
    },
  });
}

function regGet(path: string, summary: string, tag: string, responseSchema: z.ZodTypeAny = SimpleResponse) {
  registry.registerPath({
    method: "get",
    path,
    summary,
    tags: [TAGS[tag as keyof typeof TAGS] ?? tag],
    responses: {
      200: { description: "OK", content: { "application/json": { schema: responseSchema } } },
      400: BAD_REQUEST,
      500: INTERNAL_ERROR,
    },
  });
}

// ─── 1. Identity ─────────────────────────────────────────────────────────

regPost("/v1/identity/register", "Register a basic identity attestation", "identity", RegisterIdentityBody);
regPost("/v1/identity/liveness",  "Issue a liveness verification attestation", "identity", LivenessBody);
regGet("/v1/identity/{address}",  "Fetch identity data for an address", "identity");

// ─── 2. KYC ──────────────────────────────────────────────────────────────

regPost("/v1/kyc/issue",      "Issue a basic KYC attestation",   "kyc", BasicKycBody);
regPost("/v1/kyc/aml/issue",  "Issue an AML screening result",  "kyc", AmlBody);
regPost("/v1/kyc/accredited", "Issue an accredited investor status", "kyc", AccreditedBody);
regPost("/v1/kyc/age-gate",   "Issue an age gate (over 18) attestation", "kyc", AgeGateBody);
regGet("/v1/kyc/status/{address}", "Fetch KYC status for an address", "kyc");

// ─── 3. Credentials ─────────────────────────────────────────────────────

regPost("/v1/credentials/certify",  "Issue a professional certification",        "credentials", CertifyBody);
regPost("/v1/credentials/license",  "Issue a professional license",              "credentials", LicenseBody);
regPost("/v1/credentials/endorse",  "Endorse a subject's skill",                 "credentials", EndorseBody);
regGet("/v1/credentials/{address}", "Fetch credentials for an address",          "credentials");

// ─── 4. DAO ──────────────────────────────────────────────────────────────

regPost("/v1/dao/enroll",                 "Enroll a member in a DAO",            "dao", EnrollBody);
regPost("/v1/dao/participation/update",   "Update a member's participation record", "dao", ParticipationBody);
regPost("/v1/dao/delegate",               "Record a delegate relationship",      "dao", DelegateBody);
regGet("/v1/dao/member/{address}",        "Check if address is a DAO member",    "dao");

// ─── 5. Reputation ──────────────────────────────────────────────────────

regPost("/v1/reputation/record",        "Record a reputation score for a subject",    "reputation", RecordReputationBody);
regPost("/v1/reputation/interaction",   "Record a positive interaction event",        "reputation", InteractionBody);
regPost("/v1/reputation/dispute",       "Record a dispute against a subject",         "reputation", DisputeBody);
regGet("/v1/reputation/score/{address}", "Fetch reputation score for an address",     "reputation");
regGet("/v1/reputation/history/{address}", "Fetch reputation event history",          "reputation");

// ─── 6. Employment ───────────────────────────────────────────────────────

regPost("/v1/employment/issue",      "Issue an employment record",         "employment", IssueEmploymentBody);
regPost("/v1/employment/income",     "Issue an income band attestation",   "employment", IncomeBody);
regPost("/v1/employment/contractor", "Issue a contractor record",          "employment", ContractorBody);
regGet("/v1/employment/{address}",   "Fetch employment history",           "employment");

// ─── 7. Education ───────────────────────────────────────────────────────

regPost("/v1/education/degree",    "Issue a degree attestation",            "education", DegreeBody);
regPost("/v1/education/course",    "Issue a course completion certificate", "education", CourseBody);
regPost("/v1/education/bootcamp",  "Issue a bootcamp graduate attestation",  "education", BootcampBody);
regGet("/v1/education/{address}",  "Fetch education history",               "education");

// ─── 8. Social ──────────────────────────────────────────────────────────

regPost("/v1/social/link",                "Link a social media account to a subject",   "social", LinkAccountBody);
regPost("/v1/social/humanity",            "Issue a humanity proof (Worldcoin, etc.)",    "social", HumanityBody);
regPost("/v1/social/follower-milestone",  "Record a follower milestone achievement",     "social", FollowerMilestoneBody);
regGet("/v1/social/{address}",            "Fetch social data for an address",            "social");

// ─── 9. Custom ──────────────────────────────────────────────────────────

regPost("/v1/custom/schema/register",  "Compute a deterministic schema ID for a custom schema", "custom", RegisterSchemaBody);
regGet("/v1/custom/schema/{schemaId}", "Fetch a registered custom schema definition",            "custom");
regPost("/v1/custom/attest",            "Issue a custom-schema attestation",                      "custom", CustomAttestBody);
regGet("/v1/custom/claims/{address}",   "Fetch custom claims for an address",                     "custom");

// ─── Bulk ──────────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/v1/bulk",
  summary: "Bulk-issue attestations from pre-validated JSON items",
  tags: [TAGS.bulk],
  request: { body: { content: { "application/json": { schema: BulkJsonBody } } } },
  responses: {
    200: { description: "Bulk processed", content: { "application/json": { schema: BulkResponseData } } },
    400: BAD_REQUEST,
    401: UNAUTHORIZED,
    422: { description: "All rows failed validation", content: { "application/json": { schema: ErrorResponse } } },
    500: INTERNAL_ERROR,
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/bulk/csv",
  summary: "Bulk-issue attestations from a CSV string (RFC-4180 with header row)",
  tags: [TAGS.bulk],
  request: { body: { content: { "application/json": { schema: BulkCsvBody } } } },
  responses: {
    200: { description: "Bulk processed", content: { "application/json": { schema: BulkResponseData } } },
    400: BAD_REQUEST,
    401: UNAUTHORIZED,
    422: { description: "All rows failed validation", content: { "application/json": { schema: ErrorResponse } } },
    500: INTERNAL_ERROR,
  },
});

// ─── Passport ──────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/v1/passport/{address}",
  summary: "Fetch aggregated multi-service passport for an address",
  tags: [TAGS.passport],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: SimpleResponse } } },
    500: INTERNAL_ERROR,
  },
});

// ─── Generate the spec ─────────────────────────────────────────────────

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title:       "ArcPass API",
      version:     "1.0.0",
      description: [
        "ArcPass is an onchain identity and attestation protocol on Arc L1.",
        "",
        "**9 attestation services** share a single `AttestationRegistry` contract and a single Circle issuer wallet per service. ",
        "All write endpoints require a wallet signature (see `requireSignedNonce` middleware) and the appropriate service's `ISSUER_ROLE`.",
        "",
        "**Decimal handling**: USDC is the native gas token on Arc. The 6-decimal ERC-20 interface is used for all application-level token amounts. `parseUnits(amount, 6)` — never `parseEther()`.",
        "",
        "**Finality**: Arc reaches deterministic finality in <1s. After a transaction is included in a block, do not wait for additional confirmations.",
        "",
        "**OpenAPI 3.1**: This spec is generated from the same zod schemas used for runtime validation. The spec can never drift from the actual request validation.",
      ].join("\n"),
      contact:    { name: "ArcPass Engineering" },
      license:    { name: "MIT" },
    },
    servers: [
      { url: "http://localhost:3001", description: "Local development" },
      { url: "https://api.arcpass.io", description: "Production" },
    ],
    tags: Object.entries(TAGS).map(([name, description]) => ({
      name: description,
      description: `ArcPass ${description} service operations`,
    })),
  });
}

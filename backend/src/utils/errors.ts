export class ArcPassError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ArcPassError";
  }
}

export const Errors = {
  IdentityAlreadyRegistered: (address: string) =>
    new ArcPassError("IDENTITY_EXISTS", `Identity already registered for ${address}`, 409),
  IdentityNotFound: (address: string) =>
    new ArcPassError("IDENTITY_NOT_FOUND", `No identity found for ${address}`, 404),
  ClaimNotFound: (claimId: string) =>
    new ArcPassError("CLAIM_NOT_FOUND", `Claim ${claimId} not found`, 404),
  ClaimInvalid: (claimId: string, reason: string) =>
    new ArcPassError("CLAIM_INVALID", `Claim ${claimId} invalid: ${reason}`, 422),
  ActiveClaimExists: (subject: string, schema: string) =>
    new ArcPassError("ACTIVE_CLAIM_EXISTS", `Subject ${subject} has active claim for ${schema}`, 409),
  InvalidSignature: () =>
    new ArcPassError("INVALID_SIGNATURE", "Signature verification failed", 401),
  NonceReused: () =>
    new ArcPassError("NONCE_REUSED", "Nonce already used", 401),
  NotIssuer: (address: string) =>
    new ArcPassError("NOT_ISSUER", `${address} does not hold ISSUER_ROLE`, 403),
  TransactionFailed: (fn: string, reason: string) =>
    new ArcPassError("TX_FAILED", `${fn} failed: ${reason}`, 502),
  ChainMismatch: (expected: string, got: string) =>
    new ArcPassError("CHAIN_MISMATCH", `Expected ${expected}, got ${got}`, 500),
  DecimalMismatch: (context: string) =>
    new ArcPassError("DECIMAL_MISMATCH", `USDC decimal error in ${context}`, 500),
  RateLimited: () =>
    new ArcPassError("RATE_LIMITED", "Too many requests", 429),
  InvalidBatchSize: (size: number) =>
    new ArcPassError("INVALID_BATCH_SIZE", `Batch size ${size} must be between 1 and 100`, 400),
  InvalidSubject: (subject: string) =>
    new ArcPassError("INVALID_SUBJECT", `Invalid subject address: ${subject}`, 400),
  InvalidSchemaId: (id: string) =>
    new ArcPassError("INVALID_SCHEMA_ID", `Invalid schema ID: ${id}`, 400),
  SchemaNotFound: (id: string) =>
    new ArcPassError("SCHEMA_NOT_FOUND", `Schema ${id} not found`, 404),
  SchemaAlreadyExists: (id: string) =>
    new ArcPassError("SCHEMA_EXISTS", `Schema ${id} already exists`, 409),
  IssuerNotConfigured: (service: string, envVar: string) =>
    new ArcPassError("ISSUER_NOT_CONFIGURED", `${service} issuer wallet not configured (${envVar})`, 503),
  ServiceTimeout: (service: string) =>
    new ArcPassError("SERVICE_TIMEOUT", `Service ${service} timed out`, 504),
  MissingFields: (fields: string[]) =>
    new ArcPassError("MISSING_FIELDS", `Missing required fields: ${fields.join(", ")}`, 400),
  ScoreNotConfigured: () =>
    new ArcPassError("SCORE_NOT_CONFIGURED", "Score registry not configured", 503),
  ScorerNotFound: (scorerId: number) =>
    new ArcPassError("SCORER_NOT_FOUND", `Scorer ${scorerId} not found`, 404),
  ScorerInactive: (scorerId: number) =>
    new ArcPassError("SCORER_INACTIVE", `Scorer ${scorerId} is inactive`, 422),
  ScoreWriteFailed: (reason: string) =>
    new ArcPassError("SCORE_WRITE_FAILED", `Score commit failed: ${reason}`, 502),
  VerificationNotFound: (id: string) =>
    new ArcPassError("VERIFICATION_NOT_FOUND", `Unknown verification ${id}`, 404),
  VerificationMismatch: () =>
    new ArcPassError("VERIFICATION_MISMATCH", "Verification does not belong to this wallet", 403),
  TaskIdMismatch: () =>
    new ArcPassError("TASK_ID_MISMATCH", "Task ID mismatch", 400),
  OpenID3ProviderFailed: (reason: string) =>
    new ArcPassError("OPENID3_PROVIDER_FAILED", `OpenID3 provider error: ${reason}`, 502),
  OpenID3AlreadyLinked: () =>
    new ArcPassError("OPENID3_ALREADY_LINKED", "This Web2 account is already linked to a different wallet", 409),
  VerificationExpired: () =>
    new ArcPassError("VERIFICATION_EXPIRED", "Verification session expired", 410),
  HumanodeVerifyFailed: (reason: string) =>
    new ArcPassError("HUMANODE_VERIFY_FAILED", `Provider verification failed: ${reason}`, 502),
  HumanodeNotUnique: () =>
    new ArcPassError("HUMANODE_NOT_UNIQUE", "Humanode did not confirm a unique living human", 422),
  HumanodeAlreadyBound: () =>
    new ArcPassError(
      "HUMANODE_ALREADY_BOUND",
      "This human identity is already linked to a different wallet",
      409
    ),
  AttestationFailed: (reason: string) =>
    new ArcPassError("ATTESTATION_FAILED", `On-chain attestation failed: ${reason}`, 502),
  ProviderVerifyFailed: (reason: string) =>
    new ArcPassError("PROVIDER_VERIFY_FAILED", `Provider verification failed: ${reason}`, 502),
  ProviderAlreadyBound: () =>
    new ArcPassError("PROVIDER_ALREADY_BOUND", "This proof is already linked to a different wallet", 409),
} as const;

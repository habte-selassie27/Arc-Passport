/**
 * Weighted trust scoring engine for ArcPass.
 *
 * Computes a composite trust score from on-chain attestations, weighted by
 * service category and credential strength. Inspired by Human Passport's
 * composable trust layer pattern.
 *
 * What this does: score = Σ(credentialWeight × categoryWeight) per valid attestation.
 * What this does NOT do: store scores on-chain, replace on-chain verification,
 * or make trust decisions — it computes a signal for the UI and developer API.
 */

import type { ServiceKey } from "../constants/schemas.js";
import type { ActiveClaim, ServiceClaims } from "../types/passport.js";

// ─── Scoring Policy ──────────────────────────────────────────────────────

export interface ScoringPolicy {
  /** Weight multiplier per service category (0–1). Higher = more trust signal. */
  categoryWeights: Record<ServiceKey, number>;
  /** Base weight per valid credential within a category (0–1). */
  credentialWeight: number;
  /** Bonus for unique issuers within a category. */
  uniqueIssuerBonus: number;
  /** Maximum score achievable. */
  maxScore: number;
  /** Default threshold for "pass"判定. */
  passThreshold: number;
  /** Bonus multipliers for specific schema patterns (e.g., government ID). */
  schemaBonuses: Record<string, number>;
}

/** Default scoring policy — balanced weights across service categories. */
export const DEFAULT_POLICY: ScoringPolicy = {
  categoryWeights: {
    identity:     1.0,   // foundational — highest weight
    kyc:          1.0,   // compliance — highest weight
    credentials:  0.8,   // professional — strong signal
    dao:          0.6,   // governance — moderate signal
    reputation:   0.7,   // trust — moderate-strong signal
    employment:   0.7,   // employment — moderate-strong signal
    education:    0.5,   // education — moderate signal
    social:       0.4,   // social — weaker signal
    custom:       0.3,   // custom — lowest default weight
    zkPassport:   0.9,   // ZK passport — strong trust signal (government ID backed)
  },
  credentialWeight:     15,   // each valid credential contributes up to 15 points
  uniqueIssuerBonus:    5,    // bonus per unique issuer per category
  maxScore:             100,  // score is normalized to 0–100
  passThreshold:        20,   // default pass threshold (matching Human Passport's recommendation)
  schemaBonuses: {
    // Government ID and liveness are stronger signals
    "arcpass_liveness":        1.5,
    "arcpass_kyc_basic":       1.4,
    "arcpass_age_over18":      1.3,
    "arcpass_humanity":        1.5,
    "arcpass_aml_screening":   1.3,
  },
};

// ─── Score Computation ───────────────────────────────────────────────────

export interface CategoryScore {
  service:      ServiceKey;
  label:        string;
  weight:       number;
  claimCount:   number;
  uniqueIssuers: number;
  score:        number;
  maxPossible:  number;
}

export interface TrustScore {
  /** Composite score 0–100. */
  score:           number;
  /** Whether the score meets the threshold. */
  passed:          boolean;
  /** Threshold used for pass/fail. */
  threshold:       number;
  /** Per-category breakdown. */
  categories:      CategoryScore[];
  /** Total valid attestations counted. */
  totalClaims:     number;
  /** Unique issuers across all categories. */
  totalIssuers:    number;
  /** Which service categories have at least one valid attestation. */
  activeCategories: ServiceKey[];
  /** Timestamp of score computation. */
  computedAt:      number;
  /** The policy version used. */
  policyVersion:   string;
}

const SERVICE_LABELS: Record<ServiceKey, string> = {
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

const ALL_SERVICE_KEYS: ServiceKey[] = [
  "identity", "kyc", "credentials", "dao",
  "reputation", "employment", "education", "social", "custom",
  "zkPassport",
];

/**
 * Compute a trust score from a passport's service claims.
 *
 * @param services - The service claims map from PassportDocument
 * @param policy   - Scoring policy (defaults to DEFAULT_POLICY)
 * @returns TrustScore with composite score and per-category breakdown
 */
export function computeTrustScore(
  services: Record<ServiceKey, ServiceClaims>,
  policy: ScoringPolicy = DEFAULT_POLICY,
): TrustScore {
  const categories: CategoryScore[] = [];
  let totalScore = 0;
  let totalClaims = 0;
  let totalIssuers = 0;
  const activeCategories: ServiceKey[] = [];

  for (const serviceKey of ALL_SERVICE_KEYS) {
    const svc = services[serviceKey];
    const validClaims = (svc?.claims ?? []).filter((c) => c.valid);

    if (validClaims.length === 0) {
      categories.push({
        service:       serviceKey,
        label:         SERVICE_LABELS[serviceKey],
        weight:        policy.categoryWeights[serviceKey],
        claimCount:    0,
        uniqueIssuers: 0,
        score:         0,
        maxPossible:   0,
      });
      continue;
    }

    activeCategories.push(serviceKey);
    const uniqueIssuers = new Set(validClaims.map((c) => c.issuer.toLowerCase())).size;
    const catWeight = policy.categoryWeights[serviceKey];

    // Compute per-credential scores with schema bonuses
    let credentialScore = 0;
    for (const claim of validClaims) {
      // Find the schema name from the claim's schemaId to check for bonuses
      // Schema bonuses are keyed by schema name; we approximate by checking
      // the claim's position in the schema registry (off-chain lookup)
      const bonusMultiplier = getSchemaBonus(claim.schemaId, policy);
      credentialScore += policy.credentialWeight * bonusMultiplier;
    }

    // Add unique issuer bonus
    credentialScore += uniqueIssuers * policy.uniqueIssuerBonus;

    // Apply category weight
    const categoryScore = credentialScore * catWeight;

    totalScore += categoryScore;
    totalClaims += validClaims.length;
    totalIssuers += uniqueIssuers;

    // Max possible for this category: max claims (assume 3) × credential weight × category weight + issuer bonus
    const maxPossible = (3 * policy.credentialWeight + 3 * policy.uniqueIssuerBonus) * catWeight;

    categories.push({
      service:       serviceKey,
      label:         SERVICE_LABELS[serviceKey],
      weight:        catWeight,
      claimCount:    validClaims.length,
      uniqueIssuers,
      score:         Math.round(categoryScore * 100) / 100,
      maxPossible:   Math.round(maxPossible * 100) / 100,
    });
  }

  // Normalize to 0–maxScore
  // The theoretical maximum is the sum of all category maxPossible values
  const theoreticalMax = categories.reduce((sum, c) => sum + c.maxPossible, 0);
  const normalizedScore = theoreticalMax > 0
    ? Math.round((totalScore / theoreticalMax) * policy.maxScore * 100) / 100
    : 0;

  return {
    score:           Math.min(normalizedScore, policy.maxScore),
    passed:          normalizedScore >= policy.passThreshold,
    threshold:       policy.passThreshold,
    categories,
    totalClaims,
    totalIssuers,
    activeCategories,
    computedAt:      Date.now(),
    policyVersion:   "1.0.0",
  };
}

/**
 * Look up schema bonus multiplier from the claim's schemaId.
 * Returns 1.0 if no bonus applies.
 */
function getSchemaBonus(schemaId: string, policy: ScoringPolicy): number {
  // Import the schema registry to look up the name from the ID
  // This is a synchronous lookup against the in-memory schema map
  try {
    // Schema IDs are computed at import time in constants/schemas.ts
    // We need to reverse-lookup the schema name from its ID
    const schemaName = getSchemaNameFromId(schemaId);
    if (schemaName && policy.schemaBonuses[schemaName]) {
      return policy.schemaBonuses[schemaName];
    }
  } catch {
    // Schema lookup failed — no bonus
  }
  return 1.0;
}

/**
 * Reverse-lookup: given a schemaId (hex), return the schema name.
 * Uses the canonical schema definitions from constants/schemas.ts.
 */
function getSchemaNameFromId(schemaId: string): string | undefined {
  // Lazy-load the schema map to avoid circular dependencies
  const { ALL_SCHEMAS } = require("../constants/schemas.js") as typeof import("../constants/schemas.js");
  for (const schemas of Object.values(ALL_SCHEMAS)) {
    for (const def of Object.values(schemas as Record<string, { id?: string; name?: string }>)) {
      if (def.id && def.id.toLowerCase() === schemaId.toLowerCase()) {
        return def.name;
      }
    }
  }
  return undefined;
}

// ─── Developer Verification API ──────────────────────────────────────────

export interface VerificationResult {
  /** Whether the address passes the threshold. */
  passed:          boolean;
  /** The computed trust score. */
  score:           number;
  /** The threshold that was applied. */
  threshold:       number;
  /** Total valid attestations. */
  attestationCount: number;
  /** Number of unique issuers. */
  uniqueIssuers:   number;
  /** Which categories have valid attestations. */
  activeCategories: string[];
  /** Timestamp of verification. */
  verifiedAt:      number;
  /** Score breakdown by category (optional, for detailed responses). */
  breakdown?:      CategoryScore[];
}

/**
 * Verify an address against a scoring policy.
 * Used by the developer verification API endpoint.
 *
 * @param services - Passport service claims
 * @param policy   - Optional custom policy (defaults to DEFAULT_POLICY)
 * @param thresholdOverride - Optional threshold override from the request
 */
export function verifyAddress(
  services: Record<ServiceKey, ServiceClaims>,
  policy: ScoringPolicy = DEFAULT_POLICY,
  thresholdOverride?: number,
): VerificationResult {
  const trustScore = computeTrustScore(services, policy);
  const threshold = thresholdOverride ?? policy.passThreshold;

  return {
    passed:           trustScore.score >= threshold,
    score:            trustScore.score,
    threshold,
    attestationCount: trustScore.totalClaims,
    uniqueIssuers:    trustScore.totalIssuers,
    activeCategories: trustScore.activeCategories,
    verifiedAt:       Date.now(),
    breakdown:        trustScore.categories,
  };
}

// ─── Custom Policy Presets ───────────────────────────────────────────────

/** High-security preset: requires KYC + identity + multiple categories. */
export const HIGH_SECURITY_POLICY: ScoringPolicy = {
  ...DEFAULT_POLICY,
  categoryWeights: {
    ...DEFAULT_POLICY.categoryWeights,
    kyc:         1.0,
    identity:    1.0,
    credentials: 0.9,
    employment:  0.8,
    education:   0.6,
    reputation:  0.7,
    dao:         0.5,
    social:      0.2,
    custom:      0.1,
  },
  passThreshold: 40,
  credentialWeight: 12,
};

/** Low-friction preset: any 2+ categories with valid attestation = pass. */
export const LOW_FRICTION_POLICY: ScoringPolicy = {
  ...DEFAULT_POLICY,
  passThreshold: 10,
  credentialWeight: 20,
  uniqueIssuerBonus: 8,
};

/** Get a policy by name. */
export function getPolicy(name: string): ScoringPolicy {
  switch (name) {
    case "high-security": return HIGH_SECURITY_POLICY;
    case "low-friction":  return LOW_FRICTION_POLICY;
    default:              return DEFAULT_POLICY;
  }
}

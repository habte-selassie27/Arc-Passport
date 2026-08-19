/**
 * Scorer constants for ArcPass Humanity Score layer.
 *
 * These must match the on-chain ScoreRegistry values and the deployment script's
 * canonical scorer configuration. The backend and frontend import from here.
 */

/** Canonical scorer IDs */
export const SCORER_IDS = {
  /** The global ArcPass scorer — always present. Computes humanity check. */
  ARCPASS_GLOBAL: 0,
  /** Custom scorer IDs are dynamic (registered by dApps on-chain). */
} as const;

/** Raw score range: 0–1000, where 825 = display "82.5" */
export const SCORE_SCALE = 1000;

/** Display divisor: raw 825 → display "82.5" */
export const SCORE_DISPLAY_DIVISOR = 10;

/** Default humanity threshold in raw units (200 = 20.0 display). */
export const HUMANITY_THRESHOLD_RAW = 200;

/** Default score TTL: 24 hours. */
export const SCORE_TTL_SECONDS = 86400;

/** In-memory cache TTL for score results: 5 minutes. */
export const SCORE_CACHE_TTL_SECONDS = 300;

/**
 * Default schema weights for the canonical scorer (scorerId 0).
 * Weight range: 0–100 (uint8 on-chain). Negative values mean deduction.
 * These must match DeployScoreLayer.s.sol exactly.
 */
export const CANONICAL_SCORER_WEIGHTS: Record<string, number> = {
  // Identity & Passport
  basic_identity:          50,
  liveness_verified:       80,

  // KYC / Compliance
  kyc_basic:               60,
  aml_screening:           70,
  accredited_investor:     90,
  age_over18:              40,

  // Professional Credentials
  certification:           55,
  license:                 65,
  skill_endorsement:       35,

  // DAO & Governance
  dao_membership:          45,
  governance_participation:60,
  delegate:                70,

  // Reputation & Trust
  reputation_score:        75,
  positive_interaction:    30,
  dispute_record:          -20,  // negative — deducts from score

  // Employment & HR
  employment_record:       60,
  income_band:             50,
  contractor_record:       40,

  // Education
  degree:                  55,
  course_completion:       30,
  bootcamp_graduate:       25,

  // Social Verification
  social_account:          20,
  humanity_proof:          85,
  follower_milestone:      15,

  // Custom / Open
  custom:                  10,
} as const;

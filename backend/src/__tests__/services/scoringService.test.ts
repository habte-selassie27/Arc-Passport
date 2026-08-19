/**
 * Tests for the weighted trust scoring engine.
 *
 * Covers:
 * - Score computation from service claims
 * - Category weights and bonuses
 * - Threshold pass/fail logic
 * - Policy presets (default, high-security, low-friction)
 * - Edge cases: no claims, all revoked, single category
 */

import { describe, it, expect } from "vitest";
import {
  computeTrustScore,
  verifyAddress,
  getPolicy,
  DEFAULT_POLICY,
  HIGH_SECURITY_POLICY,
  LOW_FRICTION_POLICY,
  type TrustScore,
  type CategoryScore,
} from "../../services/scoringService.js";
import type { ServiceClaims } from "../../types/passport.js";

// ─── Test Fixtures ───────────────────────────────────────────────────────

function createServiceClaims(
  service: string,
  claimCount: number,
  issuerPrefix = "0xissuer",
): ServiceClaims {
  const claims = Array.from({ length: claimCount }, (_, i) => ({
    claimId: `0xclaim${i}`,
    schemaId: `0xschema${i}`,
    issuer: `${issuerPrefix}${i}`,
    valid: true,
  }));

  return {
    service,
    claims,
    verified: claimCount > 0,
    claimCount,
  };
}

function createEmptyServices(): Record<string, ServiceClaims> {
  const services: Record<string, ServiceClaims> = {};
  const keys = [
    "identity", "kyc", "credentials", "dao",
    "reputation", "employment", "education", "social", "custom",
    "zkPassport",
  ];
  for (const key of keys) {
    services[key] = {
      service: key,
      claims: [],
      verified: false,
      claimCount: 0,
    };
  }
  return services;
}

function createMinimalServices(): Record<string, ServiceClaims> {
  const services = createEmptyServices();
  services.identity = createServiceClaims("identity", 1);
  services.kyc = createServiceClaims("kyc", 1);
  return services;
}

// ─── Trust Score Computation Tests ────────────────────────────────────────

describe("computeTrustScore", () => {
  it("should return zero score for empty services", () => {
    const services = createEmptyServices();
    const score = computeTrustScore(services as any);

    expect(score.score).toBe(0);
    expect(score.passed).toBe(false);
    expect(score.totalClaims).toBe(0);
    expect(score.totalIssuers).toBe(0);
    expect(score.activeCategories).toHaveLength(0);
  });

  it("should compute score for single identity claim", () => {
    const services = createEmptyServices();
    services.identity = createServiceClaims("identity", 1);
    const score = computeTrustScore(services as any);

    expect(score.score).toBeGreaterThan(0);
    expect(score.totalClaims).toBe(1);
    expect(score.totalIssuers).toBe(1);
    expect(score.activeCategories).toContain("identity");
  });

  it("should compute higher score for multiple categories", () => {
    const services = createEmptyServices();
    services.identity = createServiceClaims("identity", 2);
    services.kyc = createServiceClaims("kyc", 1);
    services.credentials = createServiceClaims("credentials", 1);

    const score = computeTrustScore(services as any);

    expect(score.score).toBeGreaterThan(20);
    expect(score.activeCategories.length).toBeGreaterThanOrEqual(3);
  });

  it("should not count invalid claims", () => {
    const services = createEmptyServices();
    services.identity = {
      service: "identity",
      claims: [
        { claimId: "0xvalid", schemaId: "0xschema", issuer: "0xissuer", valid: true },
        { claimId: "0xinvalid", schemaId: "0xschema", issuer: "0xissuer", valid: false },
      ],
      verified: true,
      claimCount: 2,
    };

    const score = computeTrustScore(services as any);

    expect(score.totalClaims).toBe(1);
  });

  it("should give higher weight to identity and kyc categories", () => {
    // Identity claim alone
    const identityOnly = createEmptyServices();
    identityOnly.identity = createServiceClaims("identity", 1);
    const scoreIdentity = computeTrustScore(identityOnly as any);

    // Social claim alone
    const socialOnly = createEmptyServices();
    socialOnly.social = createServiceClaims("social", 1);
    const scoreSocial = computeTrustScore(socialOnly as any);

    // Identity has weight 1.0, social has weight 0.4
    // Both are normalized by their category's max possible, so the raw scores differ
    // but normalized scores may be similar. Check that identity category has higher raw score.
    const identityCat = scoreIdentity.categories.find((c) => c.service === "identity");
    const socialCat = scoreSocial.categories.find((c) => c.service === "social");
    expect(identityCat!.score).toBeGreaterThan(socialCat!.score);
  });

  it("should handle multiple issuers in same category", () => {
    const services = createEmptyServices();
    services.identity = createServiceClaims("identity", 3, "0xdifferent");

    const score = computeTrustScore(services as any);

    expect(score.totalIssuers).toBe(3);
    expect(score.score).toBeGreaterThan(0);
  });

  it("should cap score at maxScore (100)", () => {
    const services = createEmptyServices();
    // Fill every category with max claims
    for (const key of Object.keys(services)) {
      services[key] = createServiceClaims(key, 3);
    }

    const score = computeTrustScore(services as any);

    expect(score.score).toBeLessThanOrEqual(100);
  });

  it("should compute category breakdown", () => {
    const services = createMinimalServices();
    const score = computeTrustScore(services as any);

    expect(score.categories).toHaveLength(10);
    expect(score.categories[0]).toHaveProperty("service");
    expect(score.categories[0]).toHaveProperty("label");
    expect(score.categories[0]).toHaveProperty("weight");
    expect(score.categories[0]).toHaveProperty("claimCount");
    expect(score.categories[0]).toHaveProperty("score");
  });

  it("should use default threshold for pass/fail", () => {
    const services = createEmptyServices();
    services.identity = createServiceClaims("identity", 5);

    const score = computeTrustScore(services as any);

    // With 5 identity claims at weight 1.0, should pass default threshold of 20
    expect(score.threshold).toBe(20);
  });
});

// ─── Verify Address Tests ─────────────────────────────────────────────────

describe("verifyAddress", () => {
  it("should return verification result with pass/fail", () => {
    const services = createMinimalServices();
    const result = verifyAddress(services as any);

    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("threshold");
    expect(result).toHaveProperty("attestationCount");
    expect(result).toHaveProperty("uniqueIssuers");
    expect(result).toHaveProperty("activeCategories");
    expect(result).toHaveProperty("verifiedAt");
  });

  it("should respect custom threshold override", () => {
    const services = createMinimalServices();
    const result = verifyAddress(services as any, DEFAULT_POLICY, 50);

    expect(result.threshold).toBe(50);
    // With only 2 categories, score is likely below 50
    expect(result.passed).toBe(false);
  });

  it("should pass with high score and low threshold", () => {
    const services = createEmptyServices();
    for (const key of Object.keys(services)) {
      services[key] = createServiceClaims(key, 2);
    }

    const result = verifyAddress(services as any, DEFAULT_POLICY, 10);

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(10);
  });

  it("should include breakdown when requested", () => {
    const services = createMinimalServices();
    const result = verifyAddress(services as any);

    // breakdown is always included in verifyAddress
    expect(result.breakdown).toBeDefined();
    expect(result.breakdown!.length).toBe(10);
  });
});

// ─── Policy Preset Tests ──────────────────────────────────────────────────

describe("getPolicy", () => {
  it("should return default policy for unknown name", () => {
    const policy = getPolicy("unknown");
    expect(policy).toBe(DEFAULT_POLICY);
  });

  it("should return high-security policy", () => {
    const policy = getPolicy("high-security");
    expect(policy).toBe(HIGH_SECURITY_POLICY);
    expect(policy.passThreshold).toBe(40);
  });

  it("should return low-friction policy", () => {
    const policy = getPolicy("low-friction");
    expect(policy).toBe(LOW_FRICTION_POLICY);
    expect(policy.passThreshold).toBe(10);
  });
});

// ─── Policy Comparison Tests ──────────────────────────────────────────────

describe("policy comparison", () => {
  it("high-security should require more to pass than default", () => {
    const services = createMinimalServices();
    const defaultResult = verifyAddress(services as any, DEFAULT_POLICY);
    const highSecurityResult = verifyAddress(services as any, HIGH_SECURITY_POLICY);

    // Same services, different thresholds
    expect(highSecurityResult.threshold).toBeGreaterThan(defaultResult.threshold);
  });

  it("low-friction should pass more easily than default", () => {
    const services = createMinimalServices();
    const defaultResult = verifyAddress(services as any, DEFAULT_POLICY);
    const lowFrictionResult = verifyAddress(services as any, LOW_FRICTION_POLICY);

    expect(lowFrictionResult.threshold).toBeLessThan(defaultResult.threshold);
  });
});

// ─── Edge Case Tests ──────────────────────────────────────────────────────

describe("edge cases", () => {
  it("should handle services with undefined claims", () => {
    const services = createEmptyServices();
    // @ts-expect-error testing edge case
    services.identity = { service: "identity", claims: undefined };

    // Should not throw
    const score = computeTrustScore(services as any);
    expect(score.score).toBe(0);
  });

  it("should handle services with null claims", () => {
    const services = createEmptyServices();
    // @ts-expect-error testing edge case
    services.identity = { service: "identity", claims: null };

    // Should not throw
    const score = computeTrustScore(services as any);
    expect(score.score).toBe(0);
  });

  it("should handle all revoked claims", () => {
    const services = createEmptyServices();
    services.identity = {
      service: "identity",
      claims: [
        { claimId: "0x1", schemaId: "0xs1", issuer: "0xi1", valid: false },
        { claimId: "0x2", schemaId: "0xs2", issuer: "0xi2", valid: false },
      ],
      verified: false,
      claimCount: 2,
    };

    const score = computeTrustScore(services as any);

    expect(score.totalClaims).toBe(0);
    expect(score.score).toBe(0);
  });

  it("should handle single claim with zero threshold", () => {
    const services = createMinimalServices();
    const result = verifyAddress(services as any, DEFAULT_POLICY, 0);

    expect(result.passed).toBe(true);
  });
});

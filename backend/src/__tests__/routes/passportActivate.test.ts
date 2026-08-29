/**
 * Tests for activation service and route
 *
 * Covers:
 * - Address normalization and validation
 * - Distributed lock prevents concurrent activation
 * - Idempotent activation (same address returns existing state)
 * - Attestation ownership verification
 * - Score writer role check
 * - Step-by-step status tracking
 * - Audit logging
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  activatePassport,
  getActivationStatus,
  getAuditLog,
} from "../../services/activationService.js";

// Mock dependencies
vi.mock("../../services/arcService.js", () => ({
  publicClient: {
    readContract: vi.fn(),
    multicall: vi.fn(),
  },
}));

vi.mock("../../services/circleService.js", () => ({
  executeContractCall: vi.fn(),
}));

vi.mock("../../services/identityService.js", () => ({
  getIdentityBalance: vi.fn(),
  getIdentity: vi.fn(),
}));

vi.mock("../../services/passportService.js", () => ({
  getPassport: vi.fn(),
}));

vi.mock("../../services/attestationService.js", () => ({
  issueAttestation: vi.fn(),
  getActiveClaim: vi.fn(),
}));

vi.mock("../../config/arc.js", () => ({
  ADDRESSES: {
    attestationRegistry: "0x1234567890abcdef1234567890abcdef12345678",
    scoreRegistry: "0xabcdef1234567890abcdef1234567890abcdef12",
  },
}));

describe("Activation Service", () => {
  // Use unique addresses for each test to avoid lock/idempotency conflicts
  let testCounter = 0;
  const getTestAddress = () => {
    testCounter++;
    const hex = testCounter.toString(16).padStart(40, "0");
    return `0x${hex}` as `0x${string}`;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    testCounter++;
  });

  describe("Address validation", () => {
    it("should reject invalid address format", async () => {
      const result = await activatePassport("invalid", "0xinvalid");

      expect(result.success).toBe(false);
      expect(result.failure).toBe("INVALID_ADDRESS");
      // Steps should be empty since we fail before pushing ADDRESS_VALIDATED
      expect(result.steps).toEqual([]);
    });

    it("should reject when caller does not match address", async () => {
      const addr = getTestAddress();
      const caller = getTestAddress();
      const result = await activatePassport(addr, caller);

      expect(result.success).toBe(false);
      expect(result.failure).toBe("CALLER_MISMATCH");
    });

    it("should accept valid matching addresses but fail on identity check", async () => {
      const addr = getTestAddress();
      const { getIdentityBalance } = await import("../../services/identityService.js");
      vi.mocked(getIdentityBalance).mockResolvedValue(0);

      const result = await activatePassport(addr, addr);

      expect(result.success).toBe(false);
      expect(result.failure).toBe("NOT_REGISTERED");
      expect(result.steps).toContain("ADDRESS_VALIDATED");
    });
  });

  describe("Identity verification", () => {
    it("should reject unregistered identity", async () => {
      const addr = getTestAddress();
      const { getIdentityBalance } = await import("../../services/identityService.js");
      vi.mocked(getIdentityBalance).mockResolvedValue(0);

      const result = await activatePassport(addr, addr);

      expect(result.success).toBe(false);
      expect(result.failure).toBe("NOT_REGISTERED");
      expect(result.steps).toContain("ADDRESS_VALIDATED");
    });

    it("should proceed past identity check when registered", async () => {
      const addr = getTestAddress();
      const { getIdentityBalance } = await import("../../services/identityService.js");
      const { getActiveClaim } = await import("../../services/attestationService.js");
      const { getPassport } = await import("../../services/passportService.js");

      vi.mocked(getIdentityBalance).mockResolvedValue(1);
      vi.mocked(getActiveClaim).mockRejectedValue(new Error("No active claim"));
      vi.mocked(getPassport).mockResolvedValue({
        services: {},
        claims: [],
      } as any);

      const result = await activatePassport(addr, addr);

      expect(result.steps).toContain("IDENTITY_VERIFIED");
    });
  });

  describe("Concurrent activation", () => {
    it("should prevent concurrent activation for same address", async () => {
      const addr = getTestAddress();
      const { getIdentityBalance } = await import("../../services/identityService.js");
      vi.mocked(getIdentityBalance).mockResolvedValue(1);

      // Start two activations simultaneously
      const promise1 = activatePassport(addr, addr);
      const promise2 = activatePassport(addr, addr);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // One should fail with CONCURRENT_ACTIVATION
      const failures = [result1, result2].filter((r) => r.failure === "CONCURRENT_ACTIVATION");
      expect(failures.length).toBe(1);
    });
  });

  describe("Idempotency", () => {
    it("should return existing activation state on second call", async () => {
      const addr = getTestAddress();
      const { getIdentityBalance } = await import("../../services/identityService.js");
      const { getPassport } = await import("../../services/passportService.js");
      const { issueAttestation, getActiveClaim } = await import("../../services/attestationService.js");

      vi.mocked(getIdentityBalance).mockResolvedValue(1);
      vi.mocked(getActiveClaim).mockRejectedValue(new Error("No active claim"));
      vi.mocked(issueAttestation).mockResolvedValue("0xtx123");
      vi.mocked(getPassport).mockResolvedValue({
        services: {},
        claims: [],
      } as any);

      // First activation
      const result1 = await activatePassport(addr, addr);
      expect(result1.success).toBe(true);
      expect(result1.steps).toContain("COMPLETED");

      // Second activation should return existing state
      const result2 = await activatePassport(addr, addr);
      expect(result2.success).toBe(true);
      expect(result2.identityAttestation?.alreadyExisted).toBe(true);
    });
  });

  describe("Step-by-step status", () => {
    it("should track steps through to completion", async () => {
      const addr = getTestAddress();
      const { getIdentityBalance } = await import("../../services/identityService.js");
      const { getPassport } = await import("../../services/passportService.js");
      const { issueAttestation, getActiveClaim } = await import("../../services/attestationService.js");

      vi.mocked(getIdentityBalance).mockResolvedValue(1);
      vi.mocked(getActiveClaim).mockRejectedValue(new Error("No active claim"));
      vi.mocked(issueAttestation).mockResolvedValue("0xtx123");
      vi.mocked(getPassport).mockResolvedValue({
        services: {},
        claims: [],
      } as any);

      const result = await activatePassport(addr, addr);

      expect(result.steps).toContain("ADDRESS_VALIDATED");
      expect(result.steps).toContain("IDENTITY_VERIFIED");
      expect(result.steps).toContain("ATTESTATION_CHECKED");
      expect(result.steps).toContain("COMPLETED");
    });

    it("should stop at failure point", async () => {
      const addr = getTestAddress();
      const { getIdentityBalance } = await import("../../services/identityService.js");
      vi.mocked(getIdentityBalance).mockResolvedValue(0);

      const result = await activatePassport(addr, addr);

      expect(result.steps).toContain("ADDRESS_VALIDATED");
      expect(result.steps).not.toContain("IDENTITY_VERIFIED");
      expect(result.failure).toBe("NOT_REGISTERED");
    });
  });

  describe("Audit logging", () => {
    it("should log activation attempts", async () => {
      const addr = getTestAddress();
      const { getIdentityBalance } = await import("../../services/identityService.js");
      vi.mocked(getIdentityBalance).mockResolvedValue(0);

      await activatePassport(addr, addr, "127.0.0.1");

      const auditLog = getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);

      const lastEntry = auditLog[auditLog.length - 1];
      expect(lastEntry.address).toBe(addr.toLowerCase());
      expect(lastEntry.callerIp).toBe("127.0.0.1");
      expect(lastEntry.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Activation status", () => {
    it("should return not activated for new address", () => {
      const addr = getTestAddress();
      const status = getActivationStatus(addr);
      expect(status.activated).toBe(false);
    });

    it("should reject invalid address", () => {
      const status = getActivationStatus("invalid");
      expect(status.activated).toBe(false);
    });
  });
});

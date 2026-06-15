import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/arcService.js", () => ({
  publicClient: {
    readContract: vi.fn(),
  },
}));

vi.mock("../../services/circleService.js", () => ({
  executeContractCall: vi.fn(),
}));

vi.mock("../../config/arc.js", () => ({
  ADDRESSES: {
    attestationRegistry: "0xAttestationRegistryAddress",
  },
}));

import { issueAttestation, revokeClaim, isValidClaim } from "../../services/attestationService.js";
import { executeContractCall } from "../../services/circleService.js";
import { publicClient } from "../../services/arcService.js";

describe("AttestationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CIRCLE_ISSUER_WALLET_ID = "test-wallet-id";
  });

  describe("issueAttestation", () => {
    it("should call executeContractCall with correct ABI signature", async () => {
      vi.mocked(executeContractCall).mockResolvedValueOnce("0xtxhash");

      const result = await issueAttestation(
        "0xSubject",
        "0xSchema",
        "0xDataCommitment",
        0
      );

      expect(executeContractCall).toHaveBeenCalledWith(
        "test-wallet-id",
        "0xAttestationRegistryAddress",
        "attest(address,bytes32,bytes32,uint256)",
        ["0xSubject", "0xSchema", "0xDataCommitment", "0"]
      );
      expect(result).toBe("0xtxhash");
    });

    it("should throw if CIRCLE_ISSUER_WALLET_ID not set", async () => {
      delete process.env.CIRCLE_ISSUER_WALLET_ID;
      await expect(issueAttestation("0xS", "0xSch", "0xData", 0)).rejects.toThrow(
        "CIRCLE_ISSUER_WALLET_ID not configured"
      );
    });
  });

  describe("revokeClaim", () => {
    it("should call executeContractCall with revoke function", async () => {
      vi.mocked(executeContractCall).mockResolvedValueOnce("0xtxhash");

      const result = await revokeClaim("0xClaimId");

      expect(executeContractCall).toHaveBeenCalledWith(
        "test-wallet-id",
        "0xAttestationRegistryAddress",
        "revoke(bytes32)",
        ["0xClaimId"]
      );
      expect(result).toBe("0xtxhash");
    });
  });

  describe("isValidClaim", () => {
    it("should call publicClient.readContract with claimId", async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(true);

      const result = await isValidClaim("0xClaimId");

      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "isValid",
          args: ["0xClaimId"],
        })
      );
      expect(result).toBe(true);
    });
  });
});

import { describe, it, expect } from "vitest";
import { BaseError, ContractFunctionRevertedError, encodeErrorResult, type Abi } from "viem";
import { parseContractError } from "../parseContractError";
import { ATTESTATION_REGISTRY_ABI } from "../../abis/AttestationRegistry";
import { SCHEMA_REGISTRY_ABI } from "../../abis/SchemaRegistry";
import { PASSPORT_VERIFIER_ABI } from "../../abis/PassportVerifier";

const ADDR_A = "0x0000000000000000000000000000000000000001";
const ADDR_B = "0x0000000000000000000000000000000000000002";
const CLAIM_ID = `0x${"11".repeat(32)}`;
const SCHEMA_ID = `0x${"22".repeat(32)}`;

/** Builds the error shape wagmi surfaces: a ContractFunctionRevertedError (possibly wrapped). */
function revertedError(abi: Abi, errorName: string, args: readonly unknown[]): BaseError {
  // encodeErrorResult infers literal types from the ABI value; we drive it at runtime
  // here, so widen the call. The encoded bytes only need the error selector for decoding.
  const data = encodeErrorResult({ abi, errorName, args } as Parameters<typeof encodeErrorResult>[0]);
  const revert = new ContractFunctionRevertedError({ abi, functionName: "attest", data });
  return new BaseError("execution reverted", { cause: revert });
}

describe("parseContractError", () => {
  it("maps ArcPass__NotIssuer to an actionable message", () => {
    const err = revertedError(ATTESTATION_REGISTRY_ABI, "ArcPass__NotIssuer", [ADDR_A]);
    expect(parseContractError(err)).toBe("Your wallet does not have issuer permissions.");
  });

  it("maps ArcPass__ClaimAlreadyRevoked to an actionable message", () => {
    const err = revertedError(ATTESTATION_REGISTRY_ABI, "ArcPass__ClaimAlreadyRevoked", [CLAIM_ID]);
    expect(parseContractError(err)).toBe("This claim has already been revoked.");
  });

  it("maps ArcPass__ActiveClaimExists to an actionable message", () => {
    const err = revertedError(ATTESTATION_REGISTRY_ABI, "ArcPass__ActiveClaimExists", [ADDR_A, SCHEMA_ID, ADDR_B]);
    expect(parseContractError(err)).toBe("An active claim already exists. Revoke it first.");
  });

  it("maps ArcPass__ClaimExpired to an actionable message", () => {
    const err = revertedError(ATTESTATION_REGISTRY_ABI, "ArcPass__ClaimExpired", [CLAIM_ID, 1750000000n]);
    expect(parseContractError(err)).toBe("This claim has expired.");
  });

  it("maps ArcPass__SchemaAlreadyExists to an actionable message", () => {
    const err = revertedError(SCHEMA_REGISTRY_ABI, "ArcPass__SchemaAlreadyExists", [SCHEMA_ID]);
    expect(parseContractError(err)).toBe("This schema version is already registered.");
  });

  it("maps ArcPass__InvalidMerkleProof to an actionable message", () => {
    const err = revertedError(PASSPORT_VERIFIER_ABI, "ArcPass__InvalidMerkleProof", [CLAIM_ID, `0x${"33".repeat(32)}`]);
    expect(parseContractError(err)).toBe("Proof failed — field data may have been erased.");
  });

  it("falls back to the raw error name for a known but unmapped custom error", () => {
    const err = revertedError(ATTESTATION_REGISTRY_ABI, "ArcPass__InvalidSubject", []);
    expect(parseContractError(err)).toBe("Contract error: ArcPass__InvalidSubject");
  });

  it("handles an undecodable revert payload without crashing", () => {
    const revert = new ContractFunctionRevertedError({
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "attest",
      data: `0xdeadbeef${"00".repeat(32)}`,
    });
    expect(parseContractError(revert)).toBe("Transaction reverted.");
  });

  it("returns the short message for non-revert BaseErrors", () => {
    const err = new BaseError("Account does not have enough funds.");
    expect(parseContractError(err)).toBe("Account does not have enough funds.");
  });

  it("returns a fallback for plain errors", () => {
    expect(parseContractError(new Error("boom"))).toBe("Unknown error");
  });

  it("returns a fallback for non-error values", () => {
    expect(parseContractError(null)).toBe("Unknown error");
    expect(parseContractError("not an error")).toBe("Unknown error");
    expect(parseContractError(undefined)).toBe("Unknown error");
  });
});

import { BaseError, ContractFunctionRevertedError } from "viem";

export function parseContractError(err: unknown): string {
  if (!(err instanceof BaseError)) return "Unknown error";

  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError) {
    switch (revert.data?.errorName) {
      case "ArcPass__NotIssuer":
        return "Your wallet does not have issuer permissions.";
      case "ArcPass__ClaimAlreadyRevoked":
        return "This claim has already been revoked.";
      case "ArcPass__ActiveClaimExists":
        return "An active claim already exists. Revoke it first.";
      case "ArcPass__ClaimExpired":
        return "This claim has expired.";
      case "ArcPass__SchemaAlreadyExists":
        return "This schema version is already registered.";
      case "ArcPass__InvalidMerkleProof":
        return "Proof failed — field data may have been erased.";
      default:
        return revert.data?.errorName
          ? `Contract error: ${revert.data.errorName}`
          : "Transaction reverted.";
    }
  }

  return err instanceof BaseError ? (err.shortMessage ?? err.message) : "Unexpected error";
}

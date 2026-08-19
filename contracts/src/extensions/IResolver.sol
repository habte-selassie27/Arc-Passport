// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IResolver
/// @notice Interface for EAS-style resolver contracts. Resolvers enforce custom business rules
///         before an attestation or revocation succeeds.
///
/// @dev    Resolver contracts are called by AttestationRegistry during attest() and revoke().
///         If the resolver reverts, the attestation/revocation fails.
///
///   Use cases: issuer allowlists, schema-specific rules, payment requirements,
///   KYC level checks, cross-contract validations.
interface IResolver {
    /// @notice Called before an attestation is created.
    /// @param  subject       The address the claim is about.
    /// @param  schemaId      The schema this claim conforms to.
    /// @param  issuer        The address creating the attestation.
    /// @param  dataCommitment  Merkle root of the claim data.
    /// @param  expiresAt     Expiry timestamp.
    /// @return allowed       True if the attestation should proceed.
    function beforeAttest(
        address subject,
        bytes32 schemaId,
        address issuer,
        bytes32 dataCommitment,
        uint256 expiresAt
    ) external view returns (bool allowed);

    /// @notice Called before an attestation is revoked.
    /// @param  claimId       The claim to revoke.
    /// @param  revoker       The address revoking the claim.
    /// @return allowed       True if the revocation should proceed.
    function beforeRevoke(bytes32 claimId, address revoker) external view returns (bool allowed);
}

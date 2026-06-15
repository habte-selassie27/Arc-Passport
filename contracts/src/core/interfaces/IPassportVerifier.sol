// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Result of a credential verification.
struct VerificationResult {
    bool      valid;
    bytes32   claimId;
    address   issuer;
    uint256   issuedAt;
    uint256   expiresAt;
    bytes32   dataCommitment;
}

/// @title IPassportVerifier
/// @notice Stateless verification contract for ArcPass claims. Relying parties call verify()
///         to check whether a subject has a valid claim for a given schema.
interface IPassportVerifier {
    /// @notice Verify a subject has a valid claim under a given schema.
    /// @param  subject   The address to verify.
    /// @param  schemaId  The schema to check.
    /// @return result    VerificationResult struct with validity flag and claim metadata.
    function verify(address subject, bytes32 schemaId) external view returns (VerificationResult memory result);

    /// @notice Batch verify a subject against multiple schemas in one call.
    /// @param  subject    The address to verify.
    /// @param  schemaIds  Array of schema IDs to check.
    /// @return results    Array of VerificationResult, one per schema.
    function verifyMulti(address subject, bytes32[] calldata schemaIds)
        external view returns (VerificationResult[] memory results);

    /// @notice Verify a single field within a claim via Merkle proof (selective disclosure).
    /// @param  claimId    The claim containing the field.
    /// @param  fieldLeaf  keccak256(abi.encode(fieldName, fieldValue)).
    /// @param  proof      Merkle proof siblings.
    /// @param  leafIndex  Index of the leaf in the Merkle tree.
    /// @return bool       True if the field is in the claim's dataCommitment.
    function verifyField(bytes32 claimId, bytes32 fieldLeaf, bytes32[] calldata proof, uint256 leafIndex)
        external view returns (bool);
}

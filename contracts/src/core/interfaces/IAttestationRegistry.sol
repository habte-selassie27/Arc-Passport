// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Onchain representation of a single attestation claim.
/// @dev Claims are keyed by claimId = keccak256(subject, schemaId, issuer, issuedAt, nonce).
///      Raw PII is never stored onchain — only dataCommitment (Merkle root) is recorded.
struct Claim {
    bytes32   claimId;
    address   subject;
    bytes32   schemaId;
    address   issuer;
    bytes32   dataCommitment;
    uint256   issuedAt;
    uint256   expiresAt;
    bool      revoked;
}

/// @title IAttestationRegistry
/// @notice Core credential store for ArcPass. Only address with ISSUER_ROLE may attest().
///         Claims are GDPR-compliant: raw PII is off-chain, onchain stores only a hash commitment.
interface IAttestationRegistry {
    event ClaimIssued(bytes32 indexed claimId, address indexed subject, address indexed issuer, bytes32 schemaId);
    event ClaimRevoked(bytes32 indexed claimId, address indexed revoker, uint256 timestamp);

    /// @notice Issue a new attestation claim.
    /// @param  subject       The address the claim is about.
    /// @param  schemaId      The schema this claim conforms to.
    /// @param  dataCommitment  Merkle root of the claim's field leaves (raw PII never onchain).
    /// @param  expiresAt     Unix timestamp when the claim expires (0 = never).
    /// @return claimId       Unique identifier for the newly issued claim.
    function attest(
        address   subject,
        bytes32   schemaId,
        bytes32   dataCommitment,
        uint256   expiresAt
    ) external returns (bytes32 claimId);

    /// @notice Revoke a previously issued claim. Only callable by REVOKER_ROLE.
    /// @param  claimId  The claim to revoke.
    function revoke(bytes32 claimId) external;

    /// @notice Get the full Claim struct for a given claimId.
    function getClaim(bytes32 claimId) external view returns (Claim memory);

    /// @notice Check whether a claim is currently valid (exists, not revoked, not expired).
    function isValid(bytes32 claimId) external view returns (bool);

    /// @notice Get the active claimId for a (subject, schemaId, issuer) triple.
    /// @return bytes32 Zero if no active claim exists.
    function getActiveClaim(address subject, bytes32 schemaId, address issuer) external view returns (bytes32);

    /// @notice Get the list of all addresses currently holding ISSUER_ROLE.
    function getIssuers() external view returns (address[] memory);

    /// @notice Get the count of addresses holding ISSUER_ROLE.
    function getIssuersCount() external view returns (uint256);

    /// @notice Check if an account has a specific role (from AccessControl).
    function hasRole(bytes32 role, address account) external view returns (bool);
}

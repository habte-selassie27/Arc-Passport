// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Onchain representation of a single attestation claim.
/// @dev Claims are keyed by claimId = keccak256(subject, schemaId, issuer, issuedAt, nonce).
///      Raw PII is never stored onchain — only dataCommitment (Merkle root) is recorded.
///      EAS-inspired fields: refUID enables composable attestation chains,
///      revokedAt tracks when revocation occurred (0 if not revoked).
struct Claim {
    bytes32   claimId;
    address   subject;
    bytes32   schemaId;
    address   issuer;
    bytes32   dataCommitment;
    uint256   issuedAt;
    uint256   expiresAt;
    bool      revoked;
    bytes32   refUID;       // EAS: reference to another attestation (composability)
    uint256   revokedAt;    // EAS: timestamp when revoked (0 = not revoked)
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

    /// @notice Issue a new attestation with EAS-style reference UID.
    /// @param  subject       The address the claim is about.
    /// @param  schemaId      The schema this claim conforms to.
    /// @param  dataCommitment  Merkle root of the claim's field leaves.
    /// @param  expiresAt     Unix timestamp when the claim expires (0 = never).
    /// @param  refUID        Reference to another attestation (bytes32(0) = no reference).
    /// @return claimId       Unique identifier for the newly issued claim.
    function attestWithRef(
        address   subject,
        bytes32   schemaId,
        bytes32   dataCommitment,
        uint256   expiresAt,
        bytes32   refUID
    ) external returns (bytes32 claimId);

    /// @notice Revoke a previously issued claim. Only callable by the issuer who created it.
    /// @param  claimId  The claim to revoke.
    function revoke(bytes32 claimId) external;

    /// @notice Emergency revocation by admin (REVOKER_ROLE, multisig only).
    /// @param  claimId  The claim to revoke.
    function adminRevoke(bytes32 claimId) external;

    /// @notice Get the full Claim struct for a given claimId.
    function getClaim(bytes32 claimId) external view returns (Claim memory);

    /// @notice Check whether a claim is currently valid (exists, not revoked, not expired).
    function isValid(bytes32 claimId) external view returns (bool);

    /// @notice Get the active claimId for a (subject, schemaId, issuer) triple.
    function getActiveClaim(address subject, bytes32 schemaId, address issuer) external view returns (bytes32);

    /// @notice Get the list of all addresses currently holding ISSUER_ROLE.
    function getIssuers() external view returns (address[] memory);

    /// @notice Get the count of addresses holding ISSUER_ROLE.
    function getIssuersCount() external view returns (uint256);

    /// @notice Check if an account has a specific role (from AccessControl).
    function hasRole(bytes32 role, address account) external view returns (bool);
}

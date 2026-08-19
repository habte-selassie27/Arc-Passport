// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IResolver.sol";

/// @title IssuerAllowlistResolver
/// @notice Resolver that restricts which issuers can attest to specific schemas.
///         Maintains a mapping of (schemaId => issuer address => allowed).
///
/// @dev    Admin can add/remove issuers per schema. Only the issuer allowlist is checked;
///         revocation is always allowed (revokers should use the standard REVOKER_ROLE gate).
contract IssuerAllowlistResolver is IResolver {
    address public admin;
    mapping(bytes32 => mapping(address => bool)) private _allowedIssuers;

    event IssuerAllowed(bytes32 indexed schemaId, address indexed issuer);
    event IssuerRemoved(bytes32 indexed schemaId, address indexed issuer);

    modifier onlyAdmin() {
        require(msg.sender == admin, "IssuerAllowlistResolver: not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /// @notice Allow an issuer to attest under a specific schema.
    function allowIssuer(bytes32 schemaId, address issuer) external onlyAdmin {
        _allowedIssuers[schemaId][issuer] = true;
        emit IssuerAllowed(schemaId, issuer);
    }

    /// @notice Remove an issuer from a schema's allowlist.
    function removeIssuer(bytes32 schemaId, address issuer) external onlyAdmin {
        _allowedIssuers[schemaId][issuer] = false;
        emit IssuerRemoved(schemaId, issuer);
    }

    /// @notice Check if an issuer is allowed for a schema.
    function isAllowed(bytes32 schemaId, address issuer) external view returns (bool) {
        return _allowedIssuers[schemaId][issuer];
    }

    /// @notice Only allows attestation if issuer is in the allowlist for the schema.
    function beforeAttest(
        address, /* subject */
        bytes32 schemaId,
        address issuer,
        bytes32, /* dataCommitment */
        uint256  /* expiresAt */
    ) external view override returns (bool) {
        return _allowedIssuers[schemaId][issuer];
    }

    /// @notice Always allows revocation.
    function beforeRevoke(bytes32, address) external pure override returns (bool) {
        return true;
    }
}

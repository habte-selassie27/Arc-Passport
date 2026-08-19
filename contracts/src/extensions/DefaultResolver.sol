// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IResolver.sol";

/// @title DefaultResolver
/// @notice A permissive resolver that always allows attestations and revocations.
///         Serves as a reference implementation and default when no custom rules are needed.
///
/// @dev    This resolver can be replaced with a custom implementation that enforces:
///   - Issuer allowlists
///   - Schema-specific rules
///   - Payment requirements
///   - KYC level checks
///   - Cross-contract validations
contract DefaultResolver is IResolver {
    /// @notice Always allows attestation.
    function beforeAttest(
        address, /* subject */
        bytes32, /* schemaId */
        address, /* issuer */
        bytes32, /* dataCommitment */
        uint256  /* expiresAt */
    ) external pure override returns (bool) {
        return true;
    }

    /// @notice Always allows revocation.
    function beforeRevoke(bytes32, address) external pure override returns (bool) {
        return true;
    }
}

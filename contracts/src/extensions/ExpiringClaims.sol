// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/interfaces/IAttestationRegistry.sol";
import "../core/errors/ArcPassErrors.sol";

/// @title ExpiringClaims
/// @notice Helper contract for checking claim expiry status and remaining time.
///         Pure view functions — no state writes. Composable with any AttestationRegistry.
contract ExpiringClaims {
    IAttestationRegistry public registry;

    /// @notice Construct with the AttestationRegistry address.
    /// @param  _registry  The AttestationRegistry address.
    constructor(address _registry) {
        if (_registry == address(0)) revert ArcPass__ZeroAddress();
        registry = IAttestationRegistry(_registry);
    }

    /// @notice Check whether a claim has expired.
    /// @param  claimId  The claim to check.
    /// @return bool     True if expiresAt != 0 and block.timestamp >= expiresAt.
    function isExpired(bytes32 claimId) external view returns (bool) {
        Claim memory c = registry.getClaim(claimId);
        if (c.expiresAt == 0) return false;
        return block.timestamp >= c.expiresAt;
    }

    /// @notice Get the remaining time before a claim expires.
    /// @param  claimId  The claim to check.
    /// @return uint256  Seconds until expiry, 0 if already expired, type(uint256).max if no expiry.
    function getTimeToExpiry(bytes32 claimId) external view returns (uint256) {
        Claim memory c = registry.getClaim(claimId);
        if (c.expiresAt == 0) return type(uint256).max;
        if (block.timestamp >= c.expiresAt) return 0;
        return c.expiresAt - block.timestamp;
    }

    /// @notice Batch check expiry for multiple claims.
    /// @param  claimIds  Array of claim IDs.
    /// @return bool[]    Array of expiry statuses.
    function isExpiredBatch(bytes32[] calldata claimIds) external view returns (bool[] memory) {
        uint256 len = claimIds.length;
        bool[] memory results = new bool[](len);
        for (uint256 i = 0; i < len; i++) {
            Claim memory c = registry.getClaim(claimIds[i]);
            results[i] = c.expiresAt != 0 && block.timestamp >= c.expiresAt;
        }
        return results;
    }

    /// @notice Get the full Claim struct for a given claimId (passthrough to registry).
    function getClaim(bytes32 claimId) external view returns (Claim memory) {
        return registry.getClaim(claimId);
    }
}

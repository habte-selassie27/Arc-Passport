// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/interfaces/IAttestationRegistry.sol";

contract MockIssuer {
    IAttestationRegistry public registry;

    constructor(address _registry) {
        registry = IAttestationRegistry(_registry);
    }

    function issueClaim(
        address subject,
        bytes32 schemaId,
        bytes32 dataCommitment,
        uint256 expiresAt
    ) external returns (bytes32) {
        return registry.attest(subject, schemaId, dataCommitment, expiresAt);
    }

    function revokeClaim(bytes32 claimId) external {
        registry.revoke(claimId);
    }
}

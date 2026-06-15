// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/interfaces/IAttestationRegistry.sol";
import "../core/errors/ArcPassErrors.sol";

/// @notice Input struct for batch attestation.
struct AttestationInput {
    address subject;
    bytes32 schemaId;
    bytes32 dataCommitment;
    uint256 expiresAt;
}

/// @title BatchAttestation
/// @notice Gas-efficient bulk attestation extension. Issues up to 100 claims in one transaction.
///         Uses try/catch so a single failure does not revert the entire batch.
///
/// @dev    This is a standalone contract (not inherited). The caller must hold ISSUER_ROLE
///         on the AttestationRegistry since the registry's own role check governs attest().
contract BatchAttestation {
    IAttestationRegistry public registry;

    event BatchIssued(uint256 count, address indexed issuer, uint256 timestamp);

    /// @notice Construct the batcher with the AttestationRegistry address.
    /// @param  _registry  The AttestationRegistry address.
    constructor(address _registry) {
        if (_registry == address(0)) revert ArcPass__ZeroAddress();
        registry = IAttestationRegistry(_registry);
    }

    /// @notice Issue up to 100 attestations in one transaction.
    /// @param  inputs  Array of AttestationInput structs.
    /// @return claimIds   Array of issued claimIds (zeroed on failure).
    /// @return successes  Array of booleans indicating per-item success.
    function batchAttest(AttestationInput[] calldata inputs)
        external
        returns (bytes32[] memory claimIds, bool[] memory successes)
    {
        uint256 len = inputs.length;
        if (len == 0 || len > 100) revert ArcPass__InvalidBatchSize(len);

        if (!registry.hasRole(keccak256("ISSUER_ROLE"), msg.sender)) {
            revert ArcPass__NotIssuer(msg.sender);
        }

        claimIds  = new bytes32[](len);
        successes = new bool[](len);

        for (uint256 i; i < len; ) {
            try registry.attest(
                inputs[i].subject,
                inputs[i].schemaId,
                inputs[i].dataCommitment,
                inputs[i].expiresAt
            ) returns (bytes32 id) {
                claimIds[i]  = id;
                successes[i] = true;
            } catch {
                successes[i] = false;
            }
            unchecked { ++i; }
        }

        emit BatchIssued(len, msg.sender, block.timestamp);
    }
}

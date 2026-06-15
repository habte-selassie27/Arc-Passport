// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPassportVerifier.sol";
import "./interfaces/IAttestationRegistry.sol";
import "./errors/ArcPassErrors.sol";

/// @title PassportVerifier
/// @notice Stateless verification contract for ArcPass claims. Reads from AttestationRegistry.
///         NOT proxied (no state to migrate — if it needs updating, redeploy and update verifiers).
///
/// @dev    verify() iterates all active issuers looking for a valid claim for (subject, schemaId).
///         verifyField() enables Merkle-based selective disclosure: the subject presents only
///         the field they wish to disclose plus a Merkle proof, without revealing other fields.
contract PassportVerifier is IPassportVerifier {
    IAttestationRegistry public attestationRegistry;

    /// @notice Construct the verifier with the AttestationRegistry address.
    /// @param  _attestationRegistry  The address of the AttestationRegistry contract.
    constructor(address _attestationRegistry) {
        if (_attestationRegistry == address(0)) revert ArcPass__ZeroAddress();
        attestationRegistry = IAttestationRegistry(_attestationRegistry);
    }

    /// @inheritdoc IPassportVerifier
    function verify(
        address subject,
        bytes32 schemaId
    ) external view returns (VerificationResult memory result) {
        if (subject == address(0)) revert ArcPass__InvalidSubject();

        address[] memory issuers = attestationRegistry.getIssuers();
        uint256 len = issuers.length;
        for (uint256 i = 0; i < len; i++) {
            bytes32 activeClaimId = _getActiveClaim(subject, schemaId, issuers[i]);
            if (activeClaimId != bytes32(0) && attestationRegistry.isValid(activeClaimId)) {
                Claim memory c = attestationRegistry.getClaim(activeClaimId);
                result = VerificationResult({
                    valid:          true,
                    claimId:        c.claimId,
                    issuer:         c.issuer,
                    issuedAt:       c.issuedAt,
                    expiresAt:      c.expiresAt,
                    dataCommitment: c.dataCommitment
                });
                return result;
            }
        }
    }

    /// @inheritdoc IPassportVerifier
    function verifyMulti(
        address subject,
        bytes32[] calldata schemaIds
    ) external view returns (VerificationResult[] memory results) {
        uint256 len = schemaIds.length;
        results = new VerificationResult[](len);
        for (uint256 i = 0; i < len; i++) {
            results[i] = this.verify(subject, schemaIds[i]);
        }
    }

    /// @inheritdoc IPassportVerifier
    function verifyField(
        bytes32   claimId,
        bytes32   fieldLeaf,
        bytes32[] calldata proof,
        uint256   leafIndex
    ) external view returns (bool) {
        Claim memory c = attestationRegistry.getClaim(claimId);
        if (c.revoked) revert ArcPass__ClaimAlreadyRevoked(claimId);
        if (c.expiresAt != 0 && block.timestamp >= c.expiresAt) revert ArcPass__ClaimExpired(claimId, c.expiresAt);

        bytes32 computedRoot = _computeMerkleRoot(fieldLeaf, proof, leafIndex);
        return computedRoot == c.dataCommitment;
    }

    /// @notice Compute a Merkle root from a leaf, proof, and leaf index.
    /// @param  leaf      The leaf hash.
    /// @param  proof     The sibling hashes along the path to the root.
    /// @param  index     The leaf's index in the tree.
    /// @return root      The computed root hash.
    function _computeMerkleRoot(
        bytes32 leaf,
        bytes32[] memory proof,
        uint256 index
    ) internal pure returns (bytes32 root) {
        root = leaf;
        uint256 len = proof.length;
        for (uint256 i = 0; i < len; i++) {
            if ((index >> i) & 1 == 0) {
                root = keccak256(abi.encodePacked(root, proof[i]));
            } else {
                root = keccak256(abi.encodePacked(proof[i], root));
            }
        }
    }

    /// @notice Get the active claimId for (subject, schemaId, issuer) via typed interface call.
    /// @dev    Uses the IAttestationRegistry interface directly instead of raw staticcall.
    function _getActiveClaim(
        address subject,
        bytes32 schemaId,
        address issuer
    ) internal view returns (bytes32) {
        try attestationRegistry.getActiveClaim(subject, schemaId, issuer) returns (bytes32 id) {
            return id;
        } catch {
            return bytes32(0);
        }
    }
}

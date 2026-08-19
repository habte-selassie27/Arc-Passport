// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPassportVerifier.sol";
import "./interfaces/IAttestationRegistry.sol";
import "./errors/ArcPassErrors.sol";

/// @dev Forward declarations for score registry views
interface IScoreRegistryView {
    function getScore(address subject, uint16 scorerId)
        external view returns (uint16 score, bool isValid, bool isHuman);
    function isHuman(address subject) external view returns (bool);
}

interface IScorerRegistryView {
    function scorers(uint16 scorerId) external view returns (
        address owner, string memory name, uint16 threshold, bool active
    );
    function getRequireAll(uint16 scorerId) external view returns (bytes32[] memory);
}

/// @title PassportVerifier
/// @notice Stateless verification contract for ArcPass claims.
///         Reads from AttestationRegistry. Optionally supports Humanity Score via ScoreRegistry.
///
/// @dev    Score registries are optional — pass address(0) to either to disable score features.
///         Existing functionality (verify, verifyMulti, verifyField) works regardless.
contract PassportVerifier is IPassportVerifier {
    IAttestationRegistry public immutable attestationRegistry;
    IScoreRegistryView public immutable scoreRegistry;
    IScorerRegistryView public immutable scorerRegistry;
    bool public immutable hasScoreSupport;

    /// @notice Construct the verifier with registry addresses.
    /// @param  _attestationRegistry  The AttestationRegistry address (required).
    /// @param  _scoreRegistry        The ScoreRegistry address (address(0) = no score support).
    /// @param  _scorerRegistry       The ScorerRegistry address (address(0) = no score support).
    constructor(
        address _attestationRegistry,
        address _scoreRegistry,
        address _scorerRegistry
    ) {
        if (_attestationRegistry == address(0)) revert ArcPass__ZeroAddress();
        attestationRegistry = IAttestationRegistry(_attestationRegistry);
        scoreRegistry = IScoreRegistryView(_scoreRegistry);
        scorerRegistry = IScorerRegistryView(_scorerRegistry);
        hasScoreSupport = _scoreRegistry != address(0) && _scorerRegistry != address(0);
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

    /// @notice Returns the on-chain committed score for a subject under a given scorer.
    function getScore(address subject, uint16 scorerId)
        external view
        returns (uint16 score_, bool isValid, bool isHuman_)
    {
        require(hasScoreSupport, "Score support not configured");
        return scoreRegistry.getScore(subject, scorerId);
    }

    /// @notice Returns true if subject passes a custom scorer's threshold
    ///         AND all required schemas are valid.
    function passesScorer(address subject, uint16 scorerId)
        external view
        returns (bool passes, string memory reason)
    {
        require(hasScoreSupport, "Score support not configured");

        if (scorerId == 0) {
            bool h = scoreRegistry.isHuman(subject);
            return h ? (true, "") : (false, "Below humanity threshold");
        }

        (, , uint16 threshold, bool active) = scorerRegistry.scorers(scorerId);
        if (!active) return (false, "Scorer is inactive");

        bytes32[] memory required = scorerRegistry.getRequireAll(scorerId);
        for (uint256 i = 0; i < required.length; i++) {
            VerificationResult memory vr = this.verify(subject, required[i]);
            if (!vr.valid) return (false, "Missing required schema");
        }

        (uint16 score_, bool isValid, ) = scoreRegistry.getScore(subject, scorerId);
        if (!isValid) return (false, "Score not found or expired");
        if (score_ < threshold) return (false, "Score below threshold");

        return (true, "");
    }

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

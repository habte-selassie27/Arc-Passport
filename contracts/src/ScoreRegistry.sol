// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./core/errors/ArcPassErrors.sol";

/**
 * @title ScoreRegistry
 * @notice Stores committed Humanity Scores for ArcPass subjects.
 *
 * The backend computes scores off-chain and commits them on-chain.
 * Scores are per (subject, scorerId) pair. scorerId 0 = canonical ArcPass global scorer.
 */
contract ScoreRegistry is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    struct ScoreRecord {
        uint16 score;
        bytes32 commitment;
        uint64 computedAt;
        uint64 expiresAt;
        bool exists;
    }

    event ScoreCommitted(
        address indexed subject,
        uint16 indexed scorerId,
        uint16 score,
        uint64 computedAt,
        uint64 expiresAt
    );
    event HumanityThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    bytes32 public constant SCORE_WRITER_ROLE = keccak256("SCORE_WRITER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public humanityThreshold;
    mapping(address => mapping(uint16 => ScoreRecord)) public scores;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the ScoreRegistry. Called once via proxy.
     * @param admin Address that receives DEFAULT_ADMIN_ROLE and UPGRADER_ROLE.
     * @param writer Address that receives SCORE_WRITER_ROLE (backend Circle wallet).
     * @param threshold Humanity threshold (raw units: 200 = 20.0 display).
     */
    function initialize(address admin, address writer, uint256 threshold) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(SCORE_WRITER_ROLE, writer);

        humanityThreshold = threshold;
    }

    /**
     * @notice Commit a score for a subject under a given scorer.
     * @param subject The wallet address.
     * @param scorerId 0 = global scorer, non-zero = custom scorer.
     * @param score_ Raw score (0–1000, where 825 = 82.5 display).
     * @param expiresAt When the score commitment expires.
     * @param commitment keccak256(abi.encodePacked(subject, scorerId, score_, computedAt)).
     */
    function commitScore(
        address subject,
        uint16 scorerId,
        uint16 score_,
        uint64 expiresAt,
        bytes32 commitment
    ) external onlyRole(SCORE_WRITER_ROLE) {
        if (subject == address(0)) revert ArcPass__ZeroAddress();

        uint64 computedAt = uint64(block.timestamp);

        scores[subject][scorerId] = ScoreRecord({
            score: score_,
            commitment: commitment,
            computedAt: computedAt,
            expiresAt: expiresAt,
            exists: true
        });

        emit ScoreCommitted(subject, scorerId, score_, computedAt, expiresAt);
    }

    /**
     * @notice Batch commit scores for multiple subjects.
     */
    function batchCommitScore(
        address[] calldata subjects,
        uint16[] calldata scorerIds,
        uint16[] calldata score_,
        uint64[] calldata expiresAts,
        bytes32[] calldata commitments
    ) external onlyRole(SCORE_WRITER_ROLE) {
        require(
            subjects.length == scorerIds.length &&
            subjects.length == score_.length &&
            subjects.length == expiresAts.length &&
            subjects.length == commitments.length,
            "ScoreRegistry: length mismatch"
        );

        for (uint256 i = 0; i < subjects.length; i++) {
            if (subjects[i] == address(0)) revert ArcPass__ZeroAddress();

            uint64 computedAt = uint64(block.timestamp);
            scores[subjects[i]][scorerIds[i]] = ScoreRecord({
                score: score_[i],
                commitment: commitments[i],
                computedAt: computedAt,
                expiresAt: expiresAts[i],
                exists: true
            });

            emit ScoreCommitted(subjects[i], scorerIds[i], score_[i], computedAt, expiresAts[i]);
        }
    }

    /**
     * @notice Get the score record for a subject under a given scorer.
     */
    function getScore(address subject, uint16 scorerId)
        external view
        returns (uint16 score, bool isValid, bool isHuman_)
    {
        ScoreRecord storage record = scores[subject][scorerId];
        score = record.score;
        isValid = record.exists && block.timestamp < record.expiresAt;
        isHuman_ = isValid && score >= uint16(humanityThreshold) && scorerId == 0;
    }

    /**
     * @notice Returns true if the score exists and has not expired.
     */
    function isScoreValid(address subject, uint16 scorerId) external view returns (bool) {
        ScoreRecord storage record = scores[subject][scorerId];
        return record.exists && block.timestamp < record.expiresAt;
    }

    /**
     * @notice Returns true if the subject is considered human (global scorer only).
     * True when: score is valid AND score >= threshold AND scorerId == 0.
     */
    function isHuman(address subject) external view returns (bool) {
        ScoreRecord storage record = scores[subject][0];
        return record.exists &&
               block.timestamp < record.expiresAt &&
               record.score >= uint16(humanityThreshold);
    }

    /**
     * @notice Update the humanity threshold. Only callable by admin.
     */
    function setHumanityThreshold(uint256 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit HumanityThresholdUpdated(humanityThreshold, newThreshold);
        humanityThreshold = newThreshold;
    }

    function _authorizeUpgrade(address newImpl)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
}

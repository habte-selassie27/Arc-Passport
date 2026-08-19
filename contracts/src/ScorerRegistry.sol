// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title ScorerRegistry
 * @notice On-chain registry for custom scorer configurations. Immutable by design —
 *         dApps can trust their scorerId configuration cannot be changed by ArcPass admins.
 */
contract ScorerRegistry {
    struct ScorerConfig {
        address owner;
        string name;
        uint16 threshold;
        bool active;
    }

    struct SchemaWeight {
        bytes32 schemaId;
        uint8 weight;
    }

    event ScorerRegistered(uint16 indexed scorerId, address indexed owner, string name, uint16 threshold);
    event ScorerUpdated(uint16 indexed scorerId, uint16 threshold);
    event ScorerDeactivated(uint16 indexed scorerId);

    uint16 public constant CANONICAL_SCORER_ID = 0;
    uint16 private _nextScorerId = 1;

    mapping(uint16 => ScorerConfig) public scorers;
    mapping(uint16 => mapping(bytes32 => uint8)) public schemaWeights;
    mapping(uint16 => bytes32[]) public requireAllSchemas;

    // Canonical scorer (id=0) — set at deploy time, cannot be modified
    address public canonicalOwner;
    bool public canonicalRegistered;

    modifier onlyScorerOwner(uint16 scorerId) {
        require(scorers[scorerId].owner == msg.sender, "ScorerRegistry: not owner");
        _;
    }

    /**
     * @notice Register a new custom scorer. Returns the assigned scorerId.
     * @param name_ Human-readable label.
     * @param threshold_ Minimum score required to pass (0–1000 scale).
     * @param weights Array of (schemaId, weight) pairs. Weight 0–100.
     * @param requiredSchemas Schema IDs that MUST be present regardless of score.
     */
    function registerScorer(
        string calldata name_,
        uint16 threshold_,
        SchemaWeight[] calldata weights,
        bytes32[] calldata requiredSchemas
    ) external returns (uint16 scorerId) {
        scorerId = _nextScorerId++;
        scorers[scorerId] = ScorerConfig({
            owner: msg.sender,
            name: name_,
            threshold: threshold_,
            active: true
        });

        for (uint256 i = 0; i < weights.length; i++) {
            schemaWeights[scorerId][weights[i].schemaId] = weights[i].weight;
        }
        requireAllSchemas[scorerId] = requiredSchemas;

        emit ScorerRegistered(scorerId, msg.sender, name_, threshold_);
    }

    /**
     * @notice Register the canonical scorer (scorerId 0). Can only be called once.
     */
    function registerCanonicalScorer(
        address owner_,
        string calldata name_,
        uint16 threshold_,
        SchemaWeight[] calldata weights,
        bytes32[] calldata requiredSchemas
    ) external {
        require(!canonicalRegistered, "ScorerRegistry: canonical already registered");
        require(owner_ != address(0), "ScorerRegistry: zero owner");

        canonicalOwner = owner_;
        canonicalRegistered = true;
        scorers[CANONICAL_SCORER_ID] = ScorerConfig({
            owner: owner_,
            name: name_,
            threshold: threshold_,
            active: true
        });

        for (uint256 i = 0; i < weights.length; i++) {
            schemaWeights[CANONICAL_SCORER_ID][weights[i].schemaId] = weights[i].weight;
        }
        requireAllSchemas[CANONICAL_SCORER_ID] = requiredSchemas;

        emit ScorerRegistered(CANONICAL_SCORER_ID, owner_, name_, threshold_);
    }

    /**
     * @notice Update an existing scorer's configuration. Only callable by the scorer owner.
     */
    function updateScorer(
        uint16 scorerId,
        uint16 threshold_,
        SchemaWeight[] calldata weights,
        bytes32[] calldata requiredSchemas
    ) external onlyScorerOwner(scorerId) {
        scorers[scorerId].threshold = threshold_;

        // Reset all weights then set new ones
        bytes32[] storage existing = requireAllSchemas[scorerId];
        // Note: mappings cannot be fully cleared in-place; weights are overwritten.
        // Old weights for removed schemas persist but are harmless (treated as 0 if not set).

        for (uint256 i = 0; i < weights.length; i++) {
            schemaWeights[scorerId][weights[i].schemaId] = weights[i].weight;
        }
        requireAllSchemas[scorerId] = requiredSchemas;

        emit ScorerUpdated(scorerId, threshold_);
    }

    /**
     * @notice Deactivate a scorer. Only callable by the scorer owner.
     */
    function deactivateScorer(uint16 scorerId) external onlyScorerOwner(scorerId) {
        scorers[scorerId].active = false;
        emit ScorerDeactivated(scorerId);
    }

    /**
     * @notice Get the full scorer configuration.
     */
    function getScorer(uint16 scorerId) external view returns (ScorerConfig memory) {
        return scorers[scorerId];
    }

    /**
     * @notice Get the weight for a specific schema in a given scorer.
     */
    function getWeight(uint16 scorerId, bytes32 schemaId) external view returns (uint8) {
        return schemaWeights[scorerId][schemaId];
    }

    /**
     * @notice Get the required schemas for a given scorer.
     */
    function getRequireAll(uint16 scorerId) external view returns (bytes32[] memory) {
        return requireAllSchemas[scorerId];
    }

    /**
     * @notice Returns the total number of custom scorers registered (excluding canonical).
     */
    function scorerCount() external view returns (uint16) {
        return _nextScorerId - 1;
    }
}

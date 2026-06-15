// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPassportVerifier, VerificationResult } from "../../core/interfaces/IPassportVerifier.sol";
import { REPUTATION_SCORE_ID } from "../schemas/ReputationSchemas.sol";

error ArcPass__ScoreBelowThreshold(address subject, uint256 score, uint256 required);

contract ReputationGate {
    IPassportVerifier public immutable verifier;
    uint256 public immutable minScore;

    constructor(address _verifier, uint256 _minScore) {
        verifier = IPassportVerifier(_verifier);
        minScore = _minScore;
    }

    modifier onlyReputable(address subject) {
        if (!isReputable(subject)) revert ArcPass__ScoreBelowThreshold(subject, 0, minScore);
        _;
    }

    /// @notice Reverts unless the subject holds an active REPUTATION_SCORE claim.
    function requireReputable(address subject) external view {
        if (!isReputable(subject)) revert ArcPass__ScoreBelowThreshold(subject, 0, minScore);
    }

    function isReputable(address subject) public view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, REPUTATION_SCORE_ID);
        return result.valid;
    }
}

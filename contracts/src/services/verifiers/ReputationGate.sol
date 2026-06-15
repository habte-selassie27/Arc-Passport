// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPassportVerifier, VerificationResult } from "../../core/interfaces/IPassportVerifier.sol";
import { REPUTATION_SCORE_ID } from "../schemas/ReputationSchemas.sol";

contract ReputationGate {
    IPassportVerifier public immutable verifier;
    uint256 public immutable minScore;

    constructor(address _verifier, uint256 _minScore) {
        verifier = IPassportVerifier(_verifier);
        minScore = _minScore;
    }

    modifier onlyReputable(address subject) {
        require(isReputable(subject), "ReputationGate: score below threshold");
        _;
    }

    /// @notice Reverts unless the subject holds an active REPUTATION_SCORE claim.
    function requireReputable(address subject) external view {
        require(isReputable(subject), "ReputationGate: score below threshold");
    }

    function isReputable(address subject) public view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, REPUTATION_SCORE_ID);
        return result.valid;
    }
}

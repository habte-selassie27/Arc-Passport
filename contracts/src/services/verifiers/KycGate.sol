// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPassportVerifier, VerificationResult } from "../../core/interfaces/IPassportVerifier.sol";
import { KYC_BASIC_ID } from "../schemas/KycSchemas.sol";

contract KycGate {
    IPassportVerifier public immutable verifier;

    constructor(address _verifier) {
        verifier = IPassportVerifier(_verifier);
    }

    modifier onlyKycVerified(address subject, uint8 minLevel) {
        require(isKycVerified(subject, minLevel), "KycGate: not KYC verified at required level");
        _;
    }

    /// @notice Reverts unless the subject holds an active KYC_BASIC claim.
    /// @dev    Public wrapper around the modifier logic so offchain callers
    ///         (and tests) can trigger the same revert path without writing
    ///         a state-mutating function.
    function requireKycVerified(address subject, uint8 minLevel) external view {
        require(isKycVerified(subject, minLevel), "KycGate: not KYC verified at required level");
    }

    function isKycVerified(address subject, uint8 minLevel) public view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, KYC_BASIC_ID);
        return result.valid;
    }
}

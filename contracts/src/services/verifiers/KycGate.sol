// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPassportVerifier, VerificationResult } from "../../core/interfaces/IPassportVerifier.sol";
import { KYC_BASIC_ID } from "../schemas/KycSchemas.sol";

error ArcPass__KycNotVerified(address subject, uint8 requiredLevel);

contract KycGate {
    IPassportVerifier public immutable verifier;

    constructor(address _verifier) {
        verifier = IPassportVerifier(_verifier);
    }

    modifier onlyKycVerified(address subject, uint8 minLevel) {
        if (!isKycVerified(subject, minLevel)) revert ArcPass__KycNotVerified(subject, minLevel);
        _;
    }

    /// @notice Reverts unless the subject holds an active KYC_BASIC claim.
    function requireKycVerified(address subject, uint8 minLevel) external view {
        if (!isKycVerified(subject, minLevel)) revert ArcPass__KycNotVerified(subject, minLevel);
    }

    function isKycVerified(address subject, uint8 minLevel) public view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, KYC_BASIC_ID);
        return result.valid;
    }
}

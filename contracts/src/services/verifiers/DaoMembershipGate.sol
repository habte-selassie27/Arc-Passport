// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPassportVerifier, VerificationResult } from "../../core/interfaces/IPassportVerifier.sol";
import { DAO_MEMBERSHIP_ID } from "../schemas/DaoSchemas.sol";

contract DaoMembershipGate {
    IPassportVerifier public immutable verifier;

    constructor(address _verifier) {
        verifier = IPassportVerifier(_verifier);
    }

    function isMember(address subject) external view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, DAO_MEMBERSHIP_ID);
        return result.valid;
    }
}

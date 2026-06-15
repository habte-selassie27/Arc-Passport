// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/interfaces/IPassportVerifier.sol";

contract MockVerifier {
    IPassportVerifier public verifier;

    constructor(address _verifier) {
        verifier = IPassportVerifier(_verifier);
    }

    function checkAccess(address subject, bytes32 schemaId) external view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, schemaId);
        return result.valid;
    }

    function checkMultiAccess(
        address subject,
        bytes32[] calldata schemaIds
    ) external view returns (bool) {
        VerificationResult[] memory results = verifier.verifyMulti(subject, schemaIds);
        for (uint256 i = 0; i < results.length; i++) {
            if (!results[i].valid) return false;
        }
        return true;
    }
}

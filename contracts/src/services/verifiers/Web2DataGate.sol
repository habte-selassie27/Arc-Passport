// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPassportVerifier, VerificationResult } from "../../core/interfaces/IPassportVerifier.sol";
import { WEB2_DATA_PROOF_ID } from "../schemas/SchemaIds.sol";

/// @notice Reverted when a subject does not hold a valid Web2 Data Proof claim.
error ArcPass__NotWeb2Verified(address subject);

/// @title Web2DataGate
/// @notice Stateless gate that reverts unless a subject holds a valid
///         `arcpass_web2_data_proof` (WEB2_DATA_PROOF_ID) attestation.
///
/// @dev    Lets third-party dApps verify that a wallet has cryptographically
///         proven ownership of Web2 data (via Primus zkTLS or equivalent).
///         Reuses the existing PassportVerifier. Not upgradeable.
contract Web2DataGate {
    IPassportVerifier public immutable verifier;

    constructor(address _verifier) {
        verifier = IPassportVerifier(_verifier);
    }

    modifier onlyWeb2Verified(address subject) {
        if (!isWeb2Verified(subject)) revert ArcPass__NotWeb2Verified(subject);
        _;
    }

    /// @notice Reverts unless `subject` holds an active WEB2_DATA_PROOF claim.
    function requireWeb2Verified(address subject) external view {
        if (!isWeb2Verified(subject)) revert ArcPass__NotWeb2Verified(subject);
    }

    /// @notice Returns true if `subject` holds a valid, non-revoked, non-expired
    ///         WEB2_DATA_PROOF claim issued by any authorised ArcPass issuer.
    function isWeb2Verified(address subject) public view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, WEB2_DATA_PROOF_ID);
        return result.valid;
    }
}

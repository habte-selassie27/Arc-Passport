// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPassportVerifier, VerificationResult } from "../../core/interfaces/IPassportVerifier.sol";
import { HUMANITY_PROOF_ID } from "../schemas/SchemaIds.sol";

/// @notice Reverted when a subject does not hold a valid Humanity Proof claim.
error ArcPass__NotHumanVerified(address subject);

/// @title HumanityGate
/// @notice Stateless gate that reverts unless a subject holds a valid
///         `arcpass_humanity` (HUMANITY_PROOF_ID) attestation.
///
/// @dev    This is the on-chain primitive that lets third-party dApps enforce
///         "one unique living human per account" Sybil-resistance using ArcPass.
///         It reuses the existing PassportVerifier rather than re-implementing
///         claim logic, so it always reflects the authoritative on-chain state.
///
///         Mirrors KycGate / DaoMembershipGate. Not upgradeable — repointing the
///         verifier address requires deploying a new gate.
contract HumanityGate {
    IPassportVerifier public immutable verifier;

    constructor(address _verifier) {
        verifier = IPassportVerifier(_verifier);
    }

    modifier onlyHumanVerified(address subject) {
        if (!isHumanVerified(subject)) revert ArcPass__NotHumanVerified(subject);
        _;
    }

    /// @notice Reverts unless `subject` holds an active HUMANITY_PROOF claim.
    function requireHumanVerified(address subject) external view {
        if (!isHumanVerified(subject)) revert ArcPass__NotHumanVerified(subject);
    }

    /// @notice Returns true if `subject` holds a valid, non-revoked, non-expired
    ///         HUMANITY_PROOF claim issued by any authorised ArcPass issuer.
    function isHumanVerified(address subject) public view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, HUMANITY_PROOF_ID);
        return result.valid;
    }
}

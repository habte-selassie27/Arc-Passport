// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPassportVerifier, VerificationResult } from "../../core/interfaces/IPassportVerifier.sol";
import { OPENID3_IDENTITY_ID } from "../schemas/SchemaIds.sol";

/// @notice Reverted when a subject does not hold a valid OpenID3 Identity claim.
error ArcPass__NotIdentityLinked(address subject);

/// @title IdentityGate
/// @notice Stateless gate that reverts unless a subject holds a valid
///         `arcpass_openid3_identity` (OPENID3_IDENTITY_ID) attestation.
///
/// @dev    Lets third-party dApps verify that a wallet has linked a Web2 identity
///         via OAuth-based authentication (GitHub, Twitter/X, Discord, Email).
///         Reuses the existing PassportVerifier. Not upgradeable.
contract IdentityGate {
    IPassportVerifier public immutable verifier;

    constructor(address _verifier) {
        verifier = IPassportVerifier(_verifier);
    }

    modifier onlyIdentityLinked(address subject) {
        if (!isIdentityLinked(subject)) revert ArcPass__NotIdentityLinked(subject);
        _;
    }

    /// @notice Reverts unless `subject` holds an active OPENID3_IDENTITY claim.
    function requireIdentityLinked(address subject) external view {
        if (!isIdentityLinked(subject)) revert ArcPass__NotIdentityLinked(subject);
    }

    /// @notice Returns true if `subject` holds a valid, non-revoked, non-expired
    ///         OPENID3_IDENTITY claim issued by any authorised ArcPass issuer.
    function isIdentityLinked(address subject) public view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, OPENID3_IDENTITY_ID);
        return result.valid;
    }
}

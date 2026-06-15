// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Custom error definitions for all ArcPass contracts.
///         Using custom errors saves ~3x gas vs require(condition, "string") on Prague EVM.

error ArcPass__NotIssuer(address caller);
error ArcPass__NotRevoker(address caller);
error ArcPass__ClaimNotFound(bytes32 claimId);
error ArcPass__ClaimAlreadyRevoked(bytes32 claimId);
error ArcPass__ActiveClaimExists(address subject, bytes32 schemaId, address issuer);
error ArcPass__ClaimExpired(bytes32 claimId, uint256 expiredAt);
error ArcPass__InvalidSubject();
error ArcPass__InvalidSchemaId();
error ArcPass__ZeroAddress();
error ArcPass__InvalidBatchSize(uint256 size);
error ArcPass__SchemaAlreadyExists(bytes32 schemaId);
error ArcPass__SchemaNotFound(bytes32 schemaId);
error ArcPass__EmptySchemaName();
error ArcPass__EmptyFieldsJson();
error ArcPass__InvalidMerkleProof(bytes32 claimId, bytes32 fieldLeaf);
error ArcPass__VerificationFailed(address subject, bytes32 schemaId);
error ArcPass__NotUpgrader(address caller);
error ArcPass__FeeTooHigh(uint256 fee, uint256 ceiling);
error ArcPass__EmptyData();
error ArcPass__InvalidExpiry();
error ArcPass__DataMismatch();
error ArcPass__NotDelegatedSigner();
error ArcPass__DelegationExpired();
error ArcPass__InvalidSignature();
error ArcPass__EmptyVersion();
error ArcPass__SchemaListExhausted();

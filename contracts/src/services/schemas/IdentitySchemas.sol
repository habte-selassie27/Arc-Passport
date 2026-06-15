// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Schema IDs MUST match the deterministic computation in SchemaRegistry.registerSchema():
//   keccak256(abi.encodePacked(name, version, fieldsJson))
// where fieldsJson is the JSON-stringified array of {name, type} field definitions
// (see backend/src/constants/schemas.ts finalize() for the canonical encoder).
//
// DO NOT change these constants unless the corresponding schema definition changes.
// Any mismatch between these and the values passed to registerSchema() will cause
// the verifier gates to silently return no valid claims (false negative).

bytes32 constant BASIC_IDENTITY_ID = keccak256(
    abi.encodePacked(
        "arcpass_identity",
        "1.0.0",
        '[{"name":"displayName","type":"string"},{"name":"avatarCid","type":"string"},{"name":"createdAt","type":"uint64"}]'
    )
);

bytes32 constant LIVENESS_VERIFIED_ID = keccak256(
    abi.encodePacked(
        "arcpass_liveness",
        "1.0.0",
        '[{"name":"verified","type":"bool"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
    )
);

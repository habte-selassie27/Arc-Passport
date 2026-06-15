// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Schema IDs MUST match the deterministic computation in SchemaRegistry.registerSchema():
//   keccak256(abi.encodePacked(name, version, fieldsJson))
// where fieldsJson is the JSON-stringified array of {name, type} field definitions
// (see backend/src/constants/schemas.ts finalize() for the canonical encoder).

bytes32 constant SOCIAL_ACCOUNT_ID = keccak256(
    abi.encodePacked(
        "arcpass_social_account",
        "1.0.0",
        '[{"name":"platform","type":"string"},{"name":"handle","type":"string"},{"name":"profileId","type":"string"},{"name":"verifiedAt","type":"uint64"}]'
    )
);

bytes32 constant HUMANITY_PROOF_ID = keccak256(
    abi.encodePacked(
        "arcpass_humanity",
        "1.0.0",
        '[{"name":"verified","type":"bool"},{"name":"mechanism","type":"string"},{"name":"nullifier","type":"bytes32"},{"name":"checkedAt","type":"uint64"}]'
    )
);

bytes32 constant FOLLOWER_MILESTONE_ID = keccak256(
    abi.encodePacked(
        "arcpass_follower_milestone",
        "1.0.0",
        '[{"name":"platform","type":"string"},{"name":"followerCount","type":"uint32"},{"name":"milestone","type":"uint32"},{"name":"verifiedAt","type":"uint64"}]'
    )
);

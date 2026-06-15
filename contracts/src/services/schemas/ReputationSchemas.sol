// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Schema IDs MUST match the deterministic computation in SchemaRegistry.registerSchema():
//   keccak256(abi.encodePacked(name, version, fieldsJson))
// where fieldsJson is the JSON-stringified array of {name, type} field definitions
// (see backend/src/constants/schemas.ts finalize() for the canonical encoder).
//
// SchemaIdParity.t.sol asserts byte-for-byte equality with the onchain registry output.

bytes32 constant REPUTATION_SCORE_ID = keccak256(
    abi.encodePacked(
        "arcpass_reputation_score",
        "1.0.0",
        '[{"name":"score","type":"uint256"},{"name":"domain","type":"string"},{"name":"dataPoints","type":"uint32"},{"name":"updatedAt","type":"uint64"}]'
    )
);

bytes32 constant POSITIVE_INTERACTION_ID = keccak256(
    abi.encodePacked(
        "arcpass_positive_interaction",
        "1.0.0",
        '[{"name":"context","type":"string"},{"name":"counterparty","type":"address"},{"name":"platform","type":"string"},{"name":"occurredAt","type":"uint64"}]'
    )
);

bytes32 constant DISPUTE_RECORD_ID = keccak256(
    abi.encodePacked(
        "arcpass_dispute_record",
        "1.0.0",
        '[{"name":"type","type":"string"},{"name":"reportedBy","type":"address"},{"name":"evidence","type":"string"},{"name":"resolvedAt","type":"uint64"}]'
    )
);

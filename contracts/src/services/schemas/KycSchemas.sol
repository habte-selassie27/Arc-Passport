// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Schema IDs MUST match the deterministic computation in SchemaRegistry.registerSchema():
//   keccak256(abi.encodePacked(name, version, fieldsJson))
// where fieldsJson is the JSON-stringified array of {name, type} field definitions
// (see backend/src/constants/schemas.ts finalize() for the canonical encoder).
//
// SchemaIdParity.t.sol asserts byte-for-byte equality with the onchain registry output.

bytes32 constant KYC_BASIC_ID = keccak256(
    abi.encodePacked(
        "arcpass_kyc_basic",
        "1.0.0",
        '[{"name":"level","type":"uint8"},{"name":"country","type":"string"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
    )
);

bytes32 constant AML_SCREENING_ID = keccak256(
    abi.encodePacked(
        "arcpass_aml_screening",
        "1.0.0",
        '[{"name":"passed","type":"bool"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
    )
);

bytes32 constant ACCREDITED_INVESTOR_ID = keccak256(
    abi.encodePacked(
        "arcpass_accredited_investor",
        "1.0.0",
        '[{"name":"jurisdiction","type":"string"},{"name":"validUntil","type":"uint64"},{"name":"provider","type":"string"}]'
    )
);

bytes32 constant AGE_OVER_18_ID = keccak256(
    abi.encodePacked(
        "arcpass_age_over18",
        "1.0.0",
        '[{"name":"over18","type":"bool"},{"name":"checkedAt","type":"uint64"},{"name":"provider","type":"string"}]'
    )
);

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Schema IDs MUST match the deterministic computation in SchemaRegistry.registerSchema():
//   keccak256(abi.encodePacked(name, version, fieldsJson))
// where fieldsJson is the JSON-stringified array of {name, type} field definitions
// (see backend/src/constants/schemas.ts finalize() for the canonical encoder).

bytes32 constant EMPLOYMENT_RECORD_ID = keccak256(
    abi.encodePacked(
        "arcpass_employment",
        "1.0.0",
        '[{"name":"employer","type":"string"},{"name":"role","type":"string"},{"name":"startDate","type":"uint64"},{"name":"endDate","type":"uint64"},{"name":"employerDid","type":"string"}]'
    )
);

bytes32 constant INCOME_BAND_ID = keccak256(
    abi.encodePacked(
        "arcpass_income_band",
        "1.0.0",
        '[{"name":"currency","type":"string"},{"name":"bandMin","type":"uint256"},{"name":"bandMax","type":"uint256"},{"name":"verifiedAt","type":"uint64"},{"name":"provider","type":"string"}]'
    )
);

bytes32 constant CONTRACTOR_RECORD_ID = keccak256(
    abi.encodePacked(
        "arcpass_contractor",
        "1.0.0",
        '[{"name":"platform","type":"string"},{"name":"completedJobs","type":"uint32"},{"name":"totalEarned","type":"uint256"},{"name":"rating","type":"uint16"},{"name":"updatedAt","type":"uint64"}]'
    )
);

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Schema IDs MUST match the deterministic computation in SchemaRegistry.registerSchema():
//   keccak256(abi.encodePacked(name, version, fieldsJson))
// where fieldsJson is the JSON-stringified array of {name, type} field definitions
// (see backend/src/constants/schemas.ts finalize() for the canonical encoder).

bytes32 constant CERTIFICATION_ID = keccak256(
    abi.encodePacked(
        "arcpass_certification",
        "1.0.0",
        '[{"name":"certName","type":"string"},{"name":"issuingBody","type":"string"},{"name":"certId","type":"string"},{"name":"issuedAt","type":"uint64"},{"name":"validUntil","type":"uint64"}]'
    )
);

bytes32 constant LICENSE_ID = keccak256(
    abi.encodePacked(
        "arcpass_license",
        "1.0.0",
        '[{"name":"licenseType","type":"string"},{"name":"licenseNumber","type":"string"},{"name":"jurisdiction","type":"string"},{"name":"issuingBody","type":"string"},{"name":"validUntil","type":"uint64"}]'
    )
);

bytes32 constant SKILL_ENDORSEMENT_ID = keccak256(
    abi.encodePacked(
        "arcpass_skill",
        "1.0.0",
        '[{"name":"skill","type":"string"},{"name":"level","type":"uint8"},{"name":"endorsedBy","type":"address"}]'
    )
);

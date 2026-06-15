// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Schema IDs MUST match the deterministic computation in SchemaRegistry.registerSchema():
//   keccak256(abi.encodePacked(name, version, fieldsJson))
// where fieldsJson is the JSON-stringified array of {name, type} field definitions
// (see backend/src/constants/schemas.ts finalize() for the canonical encoder).

bytes32 constant DEGREE_ID = keccak256(
    abi.encodePacked(
        "arcpass_degree",
        "1.0.0",
        '[{"name":"institution","type":"string"},{"name":"degree","type":"string"},{"name":"fieldOfStudy","type":"string"},{"name":"graduationYear","type":"uint16"},{"name":"institutionDid","type":"string"}]'
    )
);

bytes32 constant COURSE_COMPLETION_ID = keccak256(
    abi.encodePacked(
        "arcpass_course",
        "1.0.0",
        '[{"name":"courseName","type":"string"},{"name":"provider","type":"string"},{"name":"score","type":"uint8"},{"name":"completedAt","type":"uint64"},{"name":"certificateId","type":"string"}]'
    )
);

bytes32 constant BOOTCAMP_GRADUATE_ID = keccak256(
    abi.encodePacked(
        "arcpass_bootcamp",
        "1.0.0",
        '[{"name":"bootcamp","type":"string"},{"name":"track","type":"string"},{"name":"graduatedAt","type":"uint64"},{"name":"projectUri","type":"string"}]'
    )
);

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Schema IDs MUST match the deterministic computation in SchemaRegistry.registerSchema():
//   keccak256(abi.encodePacked(name, version, fieldsJson))
// where fieldsJson is the JSON-stringified array of {name, type} field definitions
// (see backend/src/constants/schemas.ts finalize() for the canonical encoder).
//
// SchemaIdParity.t.sol asserts byte-for-byte equality with the onchain registry output.

bytes32 constant DAO_MEMBERSHIP_ID = keccak256(
    abi.encodePacked(
        "arcpass_dao_membership",
        "1.0.0",
        '[{"name":"daoName","type":"string"},{"name":"daoAddress","type":"address"},{"name":"role","type":"string"},{"name":"joinedAt","type":"uint64"},{"name":"votingWeight","type":"uint256"}]'
    )
);

bytes32 constant GOVERNANCE_PARTICIPATION_ID = keccak256(
    abi.encodePacked(
        "arcpass_governance_participation",
        "1.0.0",
        '[{"name":"daoAddress","type":"address"},{"name":"proposalsPassed","type":"uint32"},{"name":"votesParticipated","type":"uint32"},{"name":"delegatesCount","type":"uint32"},{"name":"updatedAt","type":"uint64"}]'
    )
);

bytes32 constant DELEGATE_ID = keccak256(
    abi.encodePacked(
        "arcpass_delegate",
        "1.0.0",
        '[{"name":"daoAddress","type":"address"},{"name":"delegatedFrom","type":"address[]"},{"name":"statement","type":"string"}]'
    )
);

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

contract PrintSchemaIds is Script {
    function run() external {
        bytes32[3] memory ids;
        ids[0] = keccak256(abi.encodePacked("arcpass_kyc_basic",        "1.0.0", "[]"));
        ids[1] = keccak256(abi.encodePacked("arcpass_dao_membership",   "1.0.0", "[]"));
        ids[2] = keccak256(abi.encodePacked("arcpass_reputation_score", "1.0.0", "[]"));
        for (uint i = 0; i < 3; i++) {
            console.log("Schema ID:");
            console.logBytes32(ids[i]);
        }
    }
}

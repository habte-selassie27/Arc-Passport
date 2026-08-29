// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

interface IScoreRegistry {
    function grantRole(bytes32 role, address account) external;
    function hasRole(bytes32 role, address account) external view returns (bool);
}

contract GrantScoreRole is Script {
    function run() external {
        address scoreRegistry = vm.envAddress("SCORE_REGISTRY_ADDRESS");
        address scoreWriter = vm.envAddress("SCORE_WRITER_ADDRESS");
        bytes32 scoreWriterRole = keccak256("SCORE_WRITER_ROLE");

        vm.startBroadcast();

        if (!IScoreRegistry(scoreRegistry).hasRole(scoreWriterRole, scoreWriter)) {
            IScoreRegistry(scoreRegistry).grantRole(scoreWriterRole, scoreWriter);
            console.log("Granted SCORE_WRITER_ROLE to", scoreWriter);
        } else {
            console.log("Already has SCORE_WRITER_ROLE");
        }

        vm.stopBroadcast();
    }
}

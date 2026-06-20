// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/AttestationRegistry.sol";

/// @notice Grants ISSUER_ROLE to a single wallet for testing.
/// Run: forge script script/GrantIssuerRole.s.sol --rpc-url $ARC_RPC_URL --broadcast
contract GrantIssuerRole is Script {
    function run() external {
        string memory env = vm.envString("DEPLOYMENT_ENV");
        require(
            keccak256(bytes(env)) == keccak256(bytes("testnet")),
            "Set DEPLOYMENT_ENV=testnet"
        );

        address proxy = vm.envAddress("ATTESTATION_REGISTRY_ADDRESS");
        address issuer = vm.envAddress("ISSUER_WALLET");

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        AttestationRegistry registry = AttestationRegistry(proxy);

        bytes32 ISSUER_ROLE = keccak256("ISSUER_ROLE");
        if (!registry.hasRole(ISSUER_ROLE, issuer)) {
            registry.grantRole(ISSUER_ROLE, issuer);
            console.log("Granted ISSUER_ROLE to:", issuer);
        } else {
            console.log("Already has ISSUER_ROLE:", issuer);
        }

        vm.stopBroadcast();
    }
}

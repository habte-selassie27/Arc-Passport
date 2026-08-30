// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/extensions/HumanityOracle.sol";

interface IAttestationRegistryGrant {
    function grantRole(bytes32 role, address account) external;
}

/// @notice Deploys HumanityOracle as a UUPS proxy and grants it ISSUER_ROLE.
/// Run: forge script script/DeployHumanityOracle.s.sol --rpc-url $ARC_RPC_URL --broadcast
contract DeployHumanityOracle is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        address attestationProxy = vm.envAddress("ATTESTATION_REGISTRY_ADDRESS");
        bytes32 humanitySchemaId = vm.envBytes32("HUMANITY_SCHEMA_ID");

        require(attestationProxy != address(0), "Set ATTESTATION_REGISTRY_ADDRESS");
        require(humanitySchemaId != bytes32(0), "Set HUMANITY_SCHEMA_ID");

        console2.log("Deployer:", deployer);
        console2.log("AttestationRegistry:", attestationProxy);
        console2.log("HumanitySchemaId:", vm.toString(humanitySchemaId));

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // Deploy implementation
        HumanityOracle impl = new HumanityOracle();
        console2.log("Implementation:", address(impl));

        // Deploy UUPS proxy (admin = deployer for testnet)
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(HumanityOracle.initialize, (deployer, attestationProxy, humanitySchemaId))
        );
        console2.log("HumanityOracle proxy:", address(proxy));

        // Grant ISSUER_ROLE to oracle on AttestationRegistry
        IAttestationRegistryGrant attestation = IAttestationRegistryGrant(attestationProxy);
        bytes32 ISSUER_ROLE = keccak256("ISSUER_ROLE");
        attestation.grantRole(ISSUER_ROLE, address(proxy));
        console2.log("Granted ISSUER_ROLE to HumanityOracle");

        vm.stopBroadcast();

        console2.log("=== HumanityOracle Deployment Complete ===");
        console2.log(string.concat("HUMANITY_ORACLE_ADDRESS=", vm.toString(address(proxy))));
    }
}

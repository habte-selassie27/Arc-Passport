// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/services/verifiers/HumanityGate.sol";
import "../src/services/verifiers/Web2DataGate.sol";
import "../src/services/verifiers/IdentityGate.sol";

/// @notice Deploys the three service gate contracts and grants them ISSUER_ROLE.
/// Prerequisite: core contracts deployed via Deploy.s.sol, ATTESTATION_REGISTRY_ADDRESS set.
/// Run: forge script script/DeployGates.s.sol --rpc-url $ARC_RPC_URL --broadcast
contract DeployGates is Script {
    function run() external {
        string memory env = vm.envString("DEPLOYMENT_ENV");
        require(
            keccak256(bytes(env)) == keccak256(bytes("testnet")) ||
            keccak256(bytes(env)) == keccak256(bytes("mainnet-confirmed")),
            "Set DEPLOYMENT_ENV=testnet or DEPLOYMENT_ENV=mainnet-confirmed"
        );

        address multisig = vm.envAddress("ARC_MULTISIG_ADDRESS");
        require(multisig != address(0), "Set ARC_MULTISIG_ADDRESS");

        address attestationProxy = vm.envAddress("ATTESTATION_REGISTRY_ADDRESS");
        require(attestationProxy != address(0), "Set ATTESTATION_REGISTRY_ADDRESS");

        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        console2.log("Deployer:", deployer);
        console2.log("AttestationRegistry:", attestationProxy);

        vm.startBroadcast();

        AttestationRegistry attestation = AttestationRegistry(attestationProxy);
        bytes32 ISSUER_ROLE = keccak256("ISSUER_ROLE");

        // ── HumanityGate ──
        HumanityGate humanityGate = new HumanityGate(attestationProxy);
        console2.log("HumanityGate:", address(humanityGate));
        attestation.grantRole(ISSUER_ROLE, address(humanityGate));
        console2.log("Granted ISSUER_ROLE to HumanityGate");

        // ── Web2DataGate ──
        Web2DataGate web2DataGate = new Web2DataGate(attestationProxy);
        console2.log("Web2DataGate:", address(web2DataGate));
        attestation.grantRole(ISSUER_ROLE, address(web2DataGate));
        console2.log("Granted ISSUER_ROLE to Web2DataGate");

        // ── IdentityGate ──
        IdentityGate identityGate = new IdentityGate(attestationProxy);
        console2.log("IdentityGate:", address(identityGate));
        attestation.grantRole(ISSUER_ROLE, address(identityGate));
        console2.log("Granted ISSUER_ROLE to IdentityGate");

        vm.stopBroadcast();

        console2.log("=== Gates Deployment Complete ===");
        console2.log("Set these in backend/.env:");
        console2.log(string.concat("HUMANITY_GATE_ADDRESS=", vm.toString(address(humanityGate))));
        console2.log(string.concat("WEB2_DATA_GATE_ADDRESS=", vm.toString(address(web2DataGate))));
        console2.log(string.concat("IDENTITY_GATE_ADDRESS=", vm.toString(address(identityGate))));
        console2.log("");
        console2.log("And in frontend/.env:");
        console2.log(string.concat("VITE_HUMANITY_GATE_ADDRESS=", vm.toString(address(humanityGate))));
        console2.log(string.concat("VITE_WEB2_DATA_GATE_ADDRESS=", vm.toString(address(web2DataGate))));
        console2.log(string.concat("VITE_IDENTITY_GATE_ADDRESS=", vm.toString(address(identityGate))));
    }
}

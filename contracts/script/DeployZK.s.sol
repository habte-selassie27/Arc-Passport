// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/services/verifiers/MockGroth16Verifier.sol";
import "../src/services/verifiers/ZKVerifier.sol";
import "../src/services/verifiers/ZKPassportAdapter.sol";
import "../src/services/schemas/SchemaIds.sol";

/// @notice Deploys the ZK proof stack: MockGroth16Verifier → ZKVerifier → ZKPassportAdapter.
/// Registers a mock verifier backend, trusts standard document types, and grants
/// ISSUER_ROLE to the adapter on AttestationRegistry.
/// Prerequisite: core contracts deployed via Deploy.s.sol, ATTESTATION_REGISTRY_ADDRESS set.
/// Run: forge script script/DeployZK.s.sol --rpc-url $ARC_RPC_URL --broadcast
contract DeployZK is Script {
    function run() external {
        string memory env = vm.envString("DEPLOYMENT_ENV");
        require(
            keccak256(bytes(env)) == keccak256(bytes("testnet")) ||
            keccak256(bytes(env)) == keccak256(bytes("mainnet-confirmed")),
            "Set DEPLOYMENT_ENV=testnet or DEPLOYMENT_ENV=mainnet-confirmed"
        );

        address attestationProxy = vm.envAddress("ATTESTATION_REGISTRY_ADDRESS");
        require(attestationProxy != address(0), "Set ATTESTATION_REGISTRY_ADDRESS");

        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        console2.log("Deployer:", deployer);
        console2.log("AttestationRegistry:", attestationProxy);

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        AttestationRegistry attestation = AttestationRegistry(attestationProxy);
        bytes32 ISSUER_ROLE = keccak256("ISSUER_ROLE");

        // ── Mock Groth16 backend (testnet placeholder for a real circuit verifier) ──
        MockGroth16Verifier mockBackend = new MockGroth16Verifier(true);
        console2.log("MockGroth16Verifier:", address(mockBackend));

        // ── ZKVerifier registry ──
        ZKVerifier zkVerifier = new ZKVerifier();
        console2.log("ZKVerifier:", address(zkVerifier));
        zkVerifier.addVerifier(address(mockBackend), "MockGroth16 v1");
        console2.log("Registered verifier backend id 0");

        // ── ZKPassportAdapter ──
        ZKPassportAdapter adapter = new ZKPassportAdapter(
            attestationProxy,
            address(zkVerifier),
            PASSPORT_AUTHENTICITY_ID,
            ZK_ATTRIBUTE_PROOF_ID
        );
        console2.log("ZKPassportAdapter:", address(adapter));

        attestation.grantRole(ISSUER_ROLE, address(adapter));
        console2.log("Granted ISSUER_ROLE to ZKPassportAdapter");

        // ── Trusted document types (must match routes/zk.ts) ──
        adapter.setDocumentType("passport", true);
        adapter.setDocumentType("national_id", true);
        adapter.setDocumentType("drivers_license", true);
        adapter.setDocumentType("residence_permit", true);
        console2.log("Trusted 4 document types");

        vm.stopBroadcast();

        console2.log("=== ZK Deployment Complete ===");
        console2.log("Set these in backend/.env:");
        console2.log(string.concat("ZK_VERIFIER_ADDRESS=", vm.toString(address(zkVerifier))));
        console2.log(string.concat("ZK_PASSPORT_ADAPTER_ADDRESS=", vm.toString(address(adapter))));
        console2.log("");
        console2.log("And in frontend/.env:");
        console2.log(string.concat("VITE_ZK_VERIFIER_ADDRESS=", vm.toString(address(zkVerifier))));
        console2.log(string.concat("VITE_ZK_PASSPORT_ADAPTER_ADDRESS=", vm.toString(address(adapter))));
    }
}

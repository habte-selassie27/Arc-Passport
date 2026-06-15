// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";
import "../src/core/PassportVerifier.sol";
import "../src/extensions/BatchAttestation.sol";
import "../src/extensions/DelegatedAttestation.sol";
import "../src/extensions/ExpiringClaims.sol";

contract Deploy is Script {
    function run() external {
        string memory env = vm.envString("DEPLOYMENT_ENV");
        require(
            keccak256(bytes(env)) == keccak256(bytes("testnet")) ||
            keccak256(bytes(env)) == keccak256(bytes("mainnet-confirmed")),
            "Set DEPLOYMENT_ENV=testnet or DEPLOYMENT_ENV=mainnet-confirmed"
        );

        address multisig = vm.envAddress("ARC_MULTISIG_ADDRESS");
        require(multisig != address(0), "Set ARC_MULTISIG_ADDRESS for the protocol admin multisig");

        if (keccak256(bytes(env)) == keccak256(bytes("mainnet-confirmed"))) {
            console2.log("!!! MAINNET DEPLOYMENT - 10 second window to abort !!!");
            vm.sleep(10_000);
        }

        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        console2.log("Deployer:", deployer);
        console2.log("Multisig:", multisig);

        vm.startBroadcast();

        // ── SchemaRegistry (UUPS proxy) ──
        SchemaRegistry schemaImpl = new SchemaRegistry();
        ERC1967Proxy schemaProxy = new ERC1967Proxy(
            address(schemaImpl),
            abi.encodeCall(SchemaRegistry.initialize, (multisig))
        );
        console2.log("SchemaRegistry proxy:", address(schemaProxy));
        SchemaRegistry schema = SchemaRegistry(address(schemaProxy));

        // ── AttestationRegistry (UUPS proxy) ──
        AttestationRegistry attestationImpl = new AttestationRegistry();
        ERC1967Proxy attestationProxy = new ERC1967Proxy(
            address(attestationImpl),
            abi.encodeCall(AttestationRegistry.initialize, (multisig, address(schemaProxy)))
        );
        console2.log("AttestationRegistry proxy:", address(attestationProxy));
        AttestationRegistry attestation = AttestationRegistry(address(attestationProxy));

        // ── PassportVerifier (no proxy — stateless) ──
        PassportVerifier verifier = new PassportVerifier(address(attestationProxy));
        console2.log("PassportVerifier:", address(verifier));

        // ── Extension contracts (standalone) ──
        BatchAttestation batcher = new BatchAttestation(address(attestationProxy));
        console2.log("BatchAttestation:", address(batcher));

        DelegatedAttestation delegator = new DelegatedAttestation(address(attestationProxy));
        console2.log("DelegatedAttestation:", address(delegator));

        ExpiringClaims expirations = new ExpiringClaims(address(attestationProxy));
        console2.log("ExpiringClaims:", address(expirations));

        // ── Deployer renounces DEFAULT_ADMIN_ROLE ──
        // After this point, only multisig holds DEFAULT_ADMIN_ROLE.
        // The deployer EOA can no longer upgrade, grant roles, or pause.
        // Only run if deployer != multisig (otherwise renounceRole requires self-call)
        if (deployer != multisig) {
            attestation.renounceRole(attestation.DEFAULT_ADMIN_ROLE(), deployer);
            schema.renounceRole(schema.DEFAULT_ADMIN_ROLE(), deployer);
            console2.log("Deployer renounced DEFAULT_ADMIN_ROLE on all proxied contracts");
        } else {
            console2.log("Skipped renounceRole: deployer == multisig");
        }

        vm.stopBroadcast();

        console2.log("=== Deployment Complete ===");
        console2.log("Set these in .env:");
        console2.log(string.concat("ATTESTATION_REGISTRY_ADDRESS=", vm.toString(address(attestationProxy))));
        console2.log(string.concat("SCHEMA_REGISTRY_ADDRESS=", vm.toString(address(schemaProxy))));
        console2.log(string.concat("PASSPORT_VERIFIER_ADDRESS=", vm.toString(address(verifier))));
        console2.log(string.concat("BATCH_ATTESTATION_ADDRESS=", vm.toString(address(batcher))));
        console2.log(string.concat("DELEGATED_ATTESTATION_ADDRESS=", vm.toString(address(delegator))));
        console2.log(string.concat("EXPIRING_CLAIMS_ADDRESS=", vm.toString(address(expirations))));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";

contract SeedTestData is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        address schemaRegAddr  = vm.envAddress("SCHEMA_REGISTRY_ADDRESS");
        address attestationRegAddr = vm.envAddress("ATTESTATION_REGISTRY_ADDRESS");

        vm.startBroadcast(deployerKey);

        SchemaRegistry schemaReg = SchemaRegistry(schemaRegAddr);
        AttestationRegistry reg = AttestationRegistry(attestationRegAddr);

        // Register KYC schema
        bytes32 kycSchemaId = schemaReg.registerSchema(
            "kyc_basic",
            "1.0.0",
            '[{"name":"level","type":"uint8"},{"name":"country","type":"string"},{"name":"provider","type":"address"}]'
        );
        console2.log("KYC schema:", vm.toString(kycSchemaId));

        // Register professional schema
        bytes32 profSchemaId = schemaReg.registerSchema(
            "professional",
            "1.0.0",
            '[{"name":"title","type":"string"},{"name":"organization","type":"string"},{"name":"verified","type":"bool"}]'
        );
        console2.log("Professional schema:", vm.toString(profSchemaId));

        // Grant deployer ISSUER_ROLE
        reg.grantRole(reg.ISSUER_ROLE(), msg.sender);
        reg.grantRole(reg.REVOKER_ROLE(), msg.sender);

        // Issue test claims
        bytes32 kycData = keccak256(abi.encode(uint8(2), "US", address(0x1234)));
        bytes32 claimId = reg.attest(address(0xAAAA), kycSchemaId, kycData, 0);
        console2.log("KYC claim:", vm.toString(claimId));

        bytes32 profData = keccak256(abi.encode("Engineer", "Arc Labs", true));
        bytes32 claimId2 = reg.attest(address(0xAAAA), profSchemaId, profData, 0);
        console2.log("Professional claim:", vm.toString(claimId2));

        vm.stopBroadcast();
    }
}

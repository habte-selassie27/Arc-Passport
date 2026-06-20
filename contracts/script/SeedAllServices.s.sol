// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";

contract SeedAllServices is Script {
    SchemaRegistry private schemaReg;
    AttestationRegistry private reg;
    address private testSubject;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address schemaRegAddr  = vm.envAddress("SCHEMA_REGISTRY_ADDRESS");
        address attestationRegAddr = vm.envAddress("ATTESTATION_REGISTRY_ADDRESS");
        testSubject = vm.envAddress("TEST_SUBJECT");

        vm.startBroadcast(deployerKey);

        schemaReg = SchemaRegistry(schemaRegAddr);
        reg = AttestationRegistry(attestationRegAddr);

        reg.grantRole(reg.ISSUER_ROLE(), msg.sender);
        reg.grantRole(reg.REVOKER_ROLE(), msg.sender);

        _seedIdentity();
        _seedKyc();
        _seedCredentials();
        _seedDao();
        _seedReputation();
        _seedEmployment();
        _seedEducation();
        _seedSocial();
        _seedCustom();

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== SEED COMPLETE ===");
        console2.log("  All 9 services seeded");
    }

    function _seedIdentity() internal {
        bytes32 schemaId = schemaReg.registerSchema(
            "arcpass_identity", "3.0.0",
            '[{"name":"displayName","type":"string"},{"name":"avatarCid","type":"string"},{"name":"createdAt","type":"uint64"}]'
        );
        console2.log("Identity schema:", vm.toString(schemaId));
        bytes32 claimId = reg.attest(testSubject, schemaId, keccak256(abi.encode("Alice", "QmAvatar123", block.timestamp)), 0);
        console2.log("Identity claim:", vm.toString(claimId));
    }

    function _seedKyc() internal {
        bytes32 basicId = schemaReg.registerSchema(
            "arcpass_kyc_basic", "3.0.0",
            '[{"name":"level","type":"uint8"},{"name":"country","type":"string"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
        );
        console2.log("KYC Basic schema:", vm.toString(basicId));
        reg.attest(testSubject, basicId, keccak256(abi.encode(uint8(2), "US", "jumio", block.timestamp)), 0);

        bytes32 amlId = schemaReg.registerSchema(
            "arcpass_aml_screening", "3.0.0",
            '[{"name":"passed","type":"bool"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
        );
        reg.attest(testSubject, amlId, keccak256(abi.encode(true, "elliptic", block.timestamp)), 0);
        console2.log("KYC + AML claims issued");
    }

    function _seedCredentials() internal {
        bytes32 certId = schemaReg.registerSchema(
            "arcpass_certification", "3.0.0",
            '[{"name":"certName","type":"string"},{"name":"issuingBody","type":"string"},{"name":"certId","type":"string"},{"name":"issuedAt","type":"uint64"},{"name":"validUntil","type":"uint64"}]'
        );
        console2.log("Cert schema:", vm.toString(certId));
        reg.attest(testSubject, certId, keccak256(abi.encode("Certified Solidity Developer", "Ethereum Foundation", "CERT-001", block.timestamp, uint64(0))), 0);

        bytes32 skillId = schemaReg.registerSchema(
            "arcpass_skill", "3.0.0",
            '[{"name":"skill","type":"string"},{"name":"level","type":"uint8"},{"name":"endorsedBy","type":"address"}]'
        );
        reg.attest(testSubject, skillId, keccak256(abi.encode("Solidity", uint8(3), msg.sender)), 0);
        console2.log("Cert + Skill claims issued");
    }

    function _seedDao() internal {
        bytes32 schemaId = schemaReg.registerSchema(
            "arcpass_dao_membership", "3.0.0",
            '[{"name":"daoName","type":"string"},{"name":"daoAddress","type":"address"},{"name":"role","type":"string"},{"name":"joinedAt","type":"uint64"},{"name":"votingWeight","type":"uint256"}]'
        );
        console2.log("DAO schema:", vm.toString(schemaId));
        bytes32 claimId = reg.attest(testSubject, schemaId, keccak256(abi.encode("ArcDAO", msg.sender, "core", block.timestamp, uint256(1000))), 0);
        console2.log("DAO claim:", vm.toString(claimId));
    }

    function _seedReputation() internal {
        bytes32 schemaId = schemaReg.registerSchema(
            "arcpass_reputation_score", "3.0.0",
            '[{"name":"score","type":"uint256"},{"name":"domain","type":"string"},{"name":"dataPoints","type":"uint32"},{"name":"updatedAt","type":"uint64"}]'
        );
        console2.log("Reputation schema:", vm.toString(schemaId));
        bytes32 claimId = reg.attest(testSubject, schemaId, keccak256(abi.encode(uint256(7500), "defi", uint32(42), block.timestamp)), 0);
        console2.log("Reputation claim:", vm.toString(claimId));
    }

    function _seedEmployment() internal {
        bytes32 schemaId = schemaReg.registerSchema(
            "arcpass_employment", "3.0.0",
            '[{"name":"employer","type":"string"},{"name":"role","type":"string"},{"name":"startDate","type":"uint64"},{"name":"endDate","type":"uint64"},{"name":"employerDid","type":"string"}]'
        );
        console2.log("Employment schema:", vm.toString(schemaId));
        bytes32 claimId = reg.attest(testSubject, schemaId, keccak256(abi.encode("Circle", "Engineer", block.timestamp - 365 days, uint64(0), "")), 0);
        console2.log("Employment claim:", vm.toString(claimId));
    }

    function _seedEducation() internal {
        bytes32 schemaId = schemaReg.registerSchema(
            "arcpass_degree", "3.0.0",
            '[{"name":"institution","type":"string"},{"name":"degree","type":"string"},{"name":"fieldOfStudy","type":"string"},{"name":"graduationYear","type":"uint16"},{"name":"institutionDid","type":"string"}]'
        );
        console2.log("Degree schema:", vm.toString(schemaId));
        bytes32 claimId = reg.attest(testSubject, schemaId, keccak256(abi.encode("MIT", "BS", "Computer Science", uint16(2024), "")), 0);
        console2.log("Degree claim:", vm.toString(claimId));
    }

    function _seedSocial() internal {
        bytes32 socialId = schemaReg.registerSchema(
            "arcpass_social_account", "3.0.0",
            '[{"name":"platform","type":"string"},{"name":"handle","type":"string"},{"name":"profileId","type":"string"},{"name":"verifiedAt","type":"uint64"}]'
        );
        console2.log("Social schema:", vm.toString(socialId));
        reg.attest(testSubject, socialId, keccak256(abi.encode("github", "alice-dev", "uid-12345", block.timestamp)), 0);

        bytes32 humanityId = schemaReg.registerSchema(
            "arcpass_humanity", "3.0.0",
            '[{"name":"verified","type":"bool"},{"name":"mechanism","type":"string"},{"name":"nullifier","type":"bytes32"},{"name":"checkedAt","type":"uint64"}]'
        );
        reg.attest(testSubject, humanityId, keccak256(abi.encode(true, "worldcoin", keccak256(abi.encode(testSubject)), block.timestamp)), 0);
        console2.log("Social + Humanity claims issued");
    }

    function _seedCustom() internal {
        bytes32 schemaId = schemaReg.registerSchema(
            "arcpass_custom_example", "3.0.0",
            '[{"name":"fieldName","type":"string"},{"name":"fieldValue","type":"string"}]'
        );
        console2.log("Custom schema:", vm.toString(schemaId));
        bytes32 claimId = reg.attest(testSubject, schemaId, keccak256(abi.encode("membership_tier", "gold")), 0);
        console2.log("Custom claim:", vm.toString(claimId));
    }
}

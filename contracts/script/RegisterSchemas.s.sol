// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/SchemaRegistry.sol";

contract RegisterSchemas is Script {
    function run() external {
        address registry = vm.envAddress("SCHEMA_REGISTRY_ADDRESS");

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        SchemaRegistry sr = SchemaRegistry(registry);

        // Identity schemas
        _register(sr, "arcpass_identity", "1.0.0",
            '[{"name":"displayName","type":"string"},{"name":"avatarCid","type":"string"},{"name":"createdAt","type":"uint64"}]');
        _register(sr, "arcpass_liveness", "1.0.0",
            '[{"name":"verified","type":"bool"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]');

        // KYC
        _register(sr, "arcpass_kyc_basic", "1.0.0",
            '[{"name":"level","type":"uint8"},{"name":"country","type":"string"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]');
        _register(sr, "arcpass_kyc", "1.0.0",
            '[{"name":"verified","type":"bool"},{"name":"provider","type":"string"},{"name":"level","type":"string"},{"name":"checkedAt","type":"uint64"}]');
        _register(sr, "arcpass_aml_screening", "1.0.0",
            '[{"name":"passed","type":"bool"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]');

        // Credentials
        _register(sr, "arcpass_credentials", "1.0.0",
            '[{"name":"credentialType","type":"string"},{"name":"issuer","type":"string"},{"name":"issuedAt","type":"uint64"},{"name":"expiresAt","type":"uint64"}]');

        // DAO
        _register(sr, "arcpass_dao_membership", "1.0.0",
            '[{"name":"daoName","type":"string"},{"name":"role","type":"string"},{"name":"joinedAt","type":"uint64"}]');

        // Reputation
        _register(sr, "arcpass_reputation_score", "1.0.0",
            '[{"name":"category","type":"string"},{"name":"score","type":"uint256"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]');

        // Employment
        _register(sr, "arcpass_employment", "1.0.0",
            '[{"name":"company","type":"string"},{"name":"title","type":"string"},{"name":"startDate","type":"uint64"},{"name":"endDate","type":"uint64"}]');

        // Education
        _register(sr, "arcpass_education", "1.0.0",
            '[{"name":"institution","type":"string"},{"name":"degree","type":"string"},{"name":"field","type":"string"},{"name":"graduatedAt","type":"uint64"}]');

        // Social
        _register(sr, "arcpass_social", "1.0.0",
            '[{"name":"platform","type":"string"},{"name":"username","type":"string"},{"name":"verified","type":"bool"},{"name":"linkedAt","type":"uint64"}]');
        _register(sr, "arcpass_social_account", "1.0.0",
            '[{"name":"platform","type":"string"},{"name":"handle","type":"string"},{"name":"profileId","type":"string"},{"name":"verifiedAt","type":"uint64"}]');

        // Humanity proof
        _register(sr, "arcpass_humanity", "1.0.0",
            '[{"name":"verified","type":"bool"},{"name":"mechanism","type":"string"},{"name":"nullifier","type":"bytes32"},{"name":"checkedAt","type":"uint64"}]');

        // Follower milestone
        _register(sr, "arcpass_follower_milestone", "1.0.0",
            '[{"name":"platform","type":"string"},{"name":"followerCount","type":"uint32"},{"name":"milestone","type":"uint32"},{"name":"verifiedAt","type":"uint64"}]');

        // Web2 proof
        _register(sr, "arcpass_web2_proof", "1.0.0",
            '[{"name":"provider","type":"string"},{"name":"username","type":"string"},{"name":"verified","type":"bool"},{"name":"proofHash","type":"bytes32"},{"name":"verifiedAt","type":"uint64"}]');
        _register(sr, "arcpass_web2_data_proof", "1.0.0",
            '[{"name":"verified","type":"bool"},{"name":"provider","type":"string"},{"name":"templateId","type":"string"},{"name":"dataHash","type":"bytes32"},{"name":"checkedAt","type":"uint64"}]');

        // OpenID3 identity
        _register(sr, "arcpass_openid3_identity", "1.0.0",
            '[{"name":"linked","type":"bool"},{"name":"provider","type":"string"},{"name":"accountHandle","type":"string"},{"name":"linkedAt","type":"uint64"}]');

        // Custom
        _register(sr, "arcpass_custom", "1.0.0",
            '[{"name":"name","type":"string"},{"name":"value","type":"string"},{"name":"timestamp","type":"uint64"}]');

        vm.stopBroadcast();
    }

    function _register(SchemaRegistry sr, string memory name, string memory ver, string memory fields) internal {
        bytes32 schemaId = keccak256(abi.encodePacked(name, ver, fields));
        if (!sr.isRegistered(schemaId)) {
            sr.registerSchema(name, ver, fields);
            console.log("Registered:", name, ver);
        } else {
            console.log("Already exists:", name, ver);
        }
    }
}

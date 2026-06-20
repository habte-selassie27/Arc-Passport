// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/core/interfaces/IERC8004IdentityRegistry.sol";

contract RegisterIdentity is Script {
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external {
        string memory env = vm.envString("DEPLOYMENT_ENV");
        require(
            keccak256(bytes(env)) == keccak256(bytes("testnet")) ||
            keccak256(bytes(env)) == keccak256(bytes("mainnet-confirmed")),
            "Set DEPLOYMENT_ENV=testnet or DEPLOYMENT_ENV=mainnet-confirmed"
        );

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        string memory metadataURI = vm.envOr("METADATA_CID", string("ipfs://QmPlaceholder"));

        console2.log("Registering identity for:", deployer);
        console2.log("Metadata URI:", metadataURI);

        vm.startBroadcast(deployerKey);

        IERC8004IdentityRegistry registry = IERC8004IdentityRegistry(IDENTITY_REGISTRY);
        uint256 tokenId = registry.register(metadataURI);

        console2.log("Identity registered! tokenId:", tokenId);

        vm.stopBroadcast();
    }
}

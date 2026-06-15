// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/core/interfaces/IERC8004IdentityRegistry.sol";

contract RegisterIdentity is Script {
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        IERC8004IdentityRegistry registry = IERC8004IdentityRegistry(IDENTITY_REGISTRY);

        string memory metadataURI = string(
            abi.encodePacked(
                "ipfs://Qm",
                vm.envOr("METADATA_CID", string("0000000000000000000000000000000000000000"))
            )
        );

        uint256 tokenId = registry.register(metadataURI);
        console2.log("Identity registered, tokenId:", tokenId);

        (uint256 id, string memory uri) = registry.getIdentity(deployer);
        console2.log("Verified - tokenId:", id, "URI:", uri);

        vm.stopBroadcast();
    }
}

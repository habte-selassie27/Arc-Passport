// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/ScorerRegistry.sol";
import "../src/ScoreRegistry.sol";
import "../src/core/PassportVerifier.sol";
import "../src/core/AttestationRegistry.sol";

/// @title DeployScoreLayer
/// @notice Deploys ScorerRegistry + ScoreRegistry + upgraded PassportVerifier with score support.
///         Run after Deploy.s.sol has deployed the base contracts.
///
/// Required env:
///   DEPLOYER_PRIVATE_KEY
///   ATTESTATION_REGISTRY_ADDRESS  (from base deploy)
///   PASSPORT_VERIFIER_ADDRESS     (from base deploy)
///   SCOREWRITER_ADDRESS           (address authorized to write scores)
contract DeployScoreLayer is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        address attProxy = vm.envAddress("ATTESTATION_REGISTRY_ADDRESS");
        address oldVerifier = vm.envAddress("PASSPORT_VERIFIER_ADDRESS");
        address scoreWriter = vm.envAddress("SCOREWRITER_ADDRESS");

        console2.log("Deployer:", deployer);
        console2.log("AttestationRegistry:", attProxy);
        console2.log("Old PassportVerifier:", oldVerifier);
        console2.log("ScoreWriter:", scoreWriter);

        vm.startBroadcast();

        // ── 1. ScorerRegistry (non-upgradeable, immutable) ──
        ScorerRegistry scorerRegistry = new ScorerRegistry();
        console2.log("ScorerRegistry:", address(scorerRegistry));

        // ── 2. ScoreRegistry (UUPS proxy) ──
        ScoreRegistry scoreImpl = new ScoreRegistry();
        ERC1967Proxy scoreProxy = new ERC1967Proxy(
            address(scoreImpl),
            abi.encodeCall(ScoreRegistry.initialize, (deployer, scoreWriter, 200)) // humanity threshold = 200
        );
        console2.log("ScoreRegistry proxy:", address(scoreProxy));
        ScoreRegistry scoreRegistry = ScoreRegistry(address(scoreProxy));

        // ── 3. Register canonical scorers ──
        // Scorer ID 0 = ArcPass Global (humanity check)
        ScorerRegistry.SchemaWeight[] memory globalWeights = new ScorerRegistry.SchemaWeight[](0);
        bytes32[] memory globalRequired = new bytes32[](0);
        scorerRegistry.registerCanonicalScorer(
            deployer,
            "ArcPass Global",
            200,      // humanity threshold
            globalWeights,
            globalRequired
        );
        console2.log("Registered canonical scorer ID 0");

        // ── 4. New PassportVerifier with score support ──
        PassportVerifier newVerifier = new PassportVerifier(
            attProxy,
            address(scoreProxy),
            address(scorerRegistry)
        );
        console2.log("New PassportVerifier:", address(newVerifier));
        require(newVerifier.hasScoreSupport(), "Score support should be enabled");

        vm.stopBroadcast();

        console2.log("=== Score Layer Deployment Complete ===");
        console2.log("Add these to your .env files:");
        console2.log(string.concat("SCORER_REGISTRY_ADDRESS=", vm.toString(address(scorerRegistry))));
        console2.log(string.concat("SCORE_REGISTRY_ADDRESS=", vm.toString(address(scoreProxy))));
        console2.log(string.concat("PASSPORT_VERIFIER_ADDRESS=", vm.toString(address(newVerifier))));
    }
}

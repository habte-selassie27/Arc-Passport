// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ScorerRegistry.sol";

contract ScorerRegistryTest is Test {
    ScorerRegistry public registry;

    address admin = makeAddr("admin");
    address dapp1  = makeAddr("dapp1");
    address dapp2  = makeAddr("dapp2");

    bytes32 constant SCHEMA_KYC = keccak256("kyc_basic");
    bytes32 constant SCHEMA_LIVENESS = keccak256("liveness_verified");
    bytes32 constant SCHEMA_DAO = keccak256("dao_membership");

    function setUp() public {
        registry = new ScorerRegistry();
    }

    function test_registerScorer() public {
        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](2);
        weights[0] = ScorerRegistry.SchemaWeight(SCHEMA_KYC, 80);
        weights[1] = ScorerRegistry.SchemaWeight(SCHEMA_LIVENESS, 50);

        bytes32[] memory required = new bytes32[](1);
        required[0] = SCHEMA_KYC;

        vm.prank(dapp1);
        uint16 scorerId = registry.registerScorer("MyDAO Scorer", 450, weights, required);

        assertEq(scorerId, 1); // 0 is reserved for canonical

        ScorerRegistry.ScorerConfig memory config = registry.getScorer(scorerId);
        assertEq(config.owner, dapp1);
        assertEq(config.threshold, 450);
        assertTrue(config.active);
    }

    function test_updateScorer_onlyOwner() public {
        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](0);
        bytes32[] memory required = new bytes32[](0);

        vm.prank(dapp1);
        uint16 scorerId = registry.registerScorer("Test", 200, weights, required);

        // Non-owner tries to update
        vm.expectRevert("ScorerRegistry: not owner");
        vm.prank(dapp2);
        registry.updateScorer(scorerId, 300, weights, required);
    }

    function test_deactivateScorer() public {
        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](0);
        bytes32[] memory required = new bytes32[](0);

        vm.prank(dapp1);
        uint16 scorerId = registry.registerScorer("Test", 200, weights, required);

        vm.prank(dapp1);
        registry.deactivateScorer(scorerId);

        ScorerRegistry.ScorerConfig memory config = registry.getScorer(scorerId);
        assertFalse(config.active);
    }

    function test_registerCanonicalScorer() public {
        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](2);
        weights[0] = ScorerRegistry.SchemaWeight(SCHEMA_KYC, 80);
        weights[1] = ScorerRegistry.SchemaWeight(SCHEMA_LIVENESS, 50);

        bytes32[] memory required = new bytes32[](0);

        registry.registerCanonicalScorer(admin, "ArcPass Global", 200, weights, required);

        ScorerRegistry.ScorerConfig memory config = registry.getScorer(0);
        assertEq(config.owner, admin);
        assertEq(config.threshold, 200);
        assertTrue(config.active);
        assertTrue(registry.canonicalRegistered());
    }

    function test_registerCanonicalScorer_revertsIfAlreadyRegistered() public {
        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](0);
        bytes32[] memory required = new bytes32[](0);

        registry.registerCanonicalScorer(admin, "ArcPass Global", 200, weights, required);

        vm.expectRevert("ScorerRegistry: canonical already registered");
        registry.registerCanonicalScorer(admin, "ArcPass Global 2", 200, weights, required);
    }

    function test_scorerCount() public {
        assertEq(registry.scorerCount(), 0);

        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](0);
        bytes32[] memory required = new bytes32[](0);

        vm.prank(dapp1);
        registry.registerScorer("One", 200, weights, required);
        vm.prank(dapp2);
        registry.registerScorer("Two", 300, weights, required);

        assertEq(registry.scorerCount(), 2);
    }

    function test_getWeight() public {
        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](1);
        weights[0] = ScorerRegistry.SchemaWeight(SCHEMA_KYC, 80);

        bytes32[] memory required = new bytes32[](0);

        vm.prank(dapp1);
        uint16 scorerId = registry.registerScorer("Test", 200, weights, required);

        assertEq(registry.getWeight(scorerId, SCHEMA_KYC), 80);
        assertEq(registry.getWeight(scorerId, SCHEMA_LIVENESS), 0); // not set
    }
}

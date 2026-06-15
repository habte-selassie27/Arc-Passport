// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/SchemaRegistry.sol";
import "../src/core/errors/ArcPassErrors.sol";

contract SchemaRegistryTest is Test {
    SchemaRegistry public schemaRegistry;
    address multisig = makeAddr("multisig");
    address stranger = makeAddr("stranger");

    function setUp() public {
        SchemaRegistry impl = new SchemaRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(SchemaRegistry.initialize, (multisig))
        );
        schemaRegistry = SchemaRegistry(address(proxy));
    }

    // ── version() ──
    function test_version() public view {
        assertEq(schemaRegistry.version(), "1.0.0");
    }

    // ── registerSchema() ──
    function test_registerSchema_success() public {
        bytes32 schemaId = schemaRegistry.registerSchema("kyc_basic", "1.0", "field_defs");
        assertTrue(schemaRegistry.isRegistered(schemaId));

        Schema memory s = schemaRegistry.getSchema(schemaId);
        assertEq(s.name, "kyc_basic");
        assertEq(s.version, "1.0");
        assertEq(s.fieldsJson, "field_defs");
        assertEq(s.registrant, address(this));
    }

    function test_registerSchema_anyoneCanRegister() public {
        vm.prank(stranger);
        bytes32 schemaId = schemaRegistry.registerSchema("custom", "1.0", "data");
        assertTrue(schemaRegistry.isRegistered(schemaId));
    }

    // ── Validation ──
    function test_registerSchema_revertsOnEmptyName() public {
        vm.expectRevert(ArcPass__EmptySchemaName.selector);
        schemaRegistry.registerSchema("", "1.0", "data");
    }

    function test_registerSchema_revertsOnEmptyVersion() public {
        vm.expectRevert(ArcPass__EmptyVersion.selector);
        schemaRegistry.registerSchema("kyc", "", "data");
    }

    function test_registerSchema_revertsOnEmptyFields() public {
        vm.expectRevert(ArcPass__EmptyFieldsJson.selector);
        schemaRegistry.registerSchema("kyc", "1.0", "");
    }

    function test_registerSchema_revertsOnDuplicate() public {
        schemaRegistry.registerSchema("dup", "1.0", "fields");
        vm.expectRevert(
            abi.encodeWithSelector(ArcPass__SchemaAlreadyExists.selector, keccak256(abi.encodePacked("dup", "1.0", "fields")))
        );
        schemaRegistry.registerSchema("dup", "1.0", "fields");
    }

    // ── Deterministic IDs ──
    function test_registerSchema_deterministicId() public {
        bytes32 id1 = schemaRegistry.registerSchema("s", "v", "f");
        bytes32 expected = keccak256(abi.encodePacked("s", "v", "f"));
        assertEq(id1, expected);
    }

    function test_registerSchema_differentVersionDifferentId() public {
        bytes32 id1 = schemaRegistry.registerSchema("kyc", "1.0", "fields");
        bytes32 id2 = schemaRegistry.registerSchema("kyc", "2.0", "fields");
        assertNotEq(id1, id2);
    }

    // ── getSchema() ──
    function test_getSchema_revertsOnMissing() public {
        bytes32 fakeId = keccak256("nonexistent");
        vm.expectRevert(abi.encodeWithSelector(ArcPass__SchemaNotFound.selector, fakeId));
        schemaRegistry.getSchema(fakeId);
    }

    // ── getSchemaCount() ──
    function test_getSchemaCount() public {
        assertEq(schemaRegistry.getSchemaCount(), 0);
        schemaRegistry.registerSchema("a", "1", "x");
        assertEq(schemaRegistry.getSchemaCount(), 1);
        schemaRegistry.registerSchema("b", "1", "y");
        assertEq(schemaRegistry.getSchemaCount(), 2);
    }

    // ── getSchemas() ──
    function test_getSchemas_pagination() public {
        for (uint i = 0; i < 5; i++) {
            schemaRegistry.registerSchema(vm.toString(i), "1", "data");
        }

        bytes32[] memory page1 = schemaRegistry.getSchemas(0, 3);
        assertEq(page1.length, 3);

        bytes32[] memory page2 = schemaRegistry.getSchemas(3, 3);
        assertEq(page2.length, 2);

        bytes32[] memory page3 = schemaRegistry.getSchemas(10, 3);
        assertEq(page3.length, 0);
    }

    // ── Pause ──
    function test_pause_blocksRegistration() public {
        vm.prank(multisig);
        schemaRegistry.pause();
        vm.expectRevert();
        schemaRegistry.registerSchema("test", "1.0", "data");
    }

    function test_pause_allowsReads() public view {
        schemaRegistry.isRegistered(keccak256("anything"));
    }

    function test_unpause_restoresRegistration() public {
        vm.startPrank(multisig);
        schemaRegistry.pause();
        schemaRegistry.unpause();
        vm.stopPrank();

        schemaRegistry.registerSchema("ok", "1.0", "data");
    }

    // ── Upgrade ──
    function test_upgrade_success() public {
        SchemaRegistry v2 = new SchemaRegistry();
        vm.prank(multisig);
        SchemaRegistry(address(schemaRegistry)).upgradeToAndCall(address(v2), "");
    }

    function test_upgrade_revertsIfNotUpgrader() public {
        SchemaRegistry v2 = new SchemaRegistry();
        vm.prank(stranger);
        vm.expectRevert();
        SchemaRegistry(address(schemaRegistry)).upgradeToAndCall(address(v2), "");
    }

    function test_upgrade_preservesState() public {
        schemaRegistry.registerSchema("keep", "1.0", "data");

        SchemaRegistry v2 = new SchemaRegistry();
        vm.prank(multisig);
        SchemaRegistry(address(schemaRegistry)).upgradeToAndCall(address(v2), "");

        assertTrue(schemaRegistry.isRegistered(keccak256(abi.encodePacked("keep", "1.0", "data"))));
        assertEq(schemaRegistry.getSchemaCount(), 1);
    }
}

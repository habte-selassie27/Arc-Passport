// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/extensions/ExpiringClaims.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";
import "../src/extensions/ExpiringClaims.sol";

contract ExpiringClaimsTest is Test {
    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    ExpiringClaims public expirations;

    address multisig = makeAddr("multisig");
    address issuer   = makeAddr("issuer");
    address subject  = makeAddr("subject");

    bytes32 constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");

    bytes32 schemaId;
    bytes32 constant DATA = keccak256("data");

    function setUp() public {
        SchemaRegistry schemaImpl = new SchemaRegistry();
        ERC1967Proxy schemaProxy = new ERC1967Proxy(
            address(schemaImpl),
            abi.encodeCall(SchemaRegistry.initialize, (multisig))
        );
        schemaRegistry = SchemaRegistry(address(schemaProxy));

        AttestationRegistry impl = new AttestationRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(AttestationRegistry.initialize, (multisig, address(schemaProxy)))
        );
        registry = AttestationRegistry(address(proxy));
        expirations = new ExpiringClaims(address(registry));

        vm.startPrank(multisig);
        registry.grantRole(ExpiringClaimsTest.ISSUER_ROLE, issuer);
        schemaId = schemaRegistry.registerSchema("test", "1.0", "fields");
        vm.stopPrank();
    }

    // ── isExpired() ──
    function test_isExpired_nonExpiring() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, 0);
        assertFalse(expirations.isExpired(claimId));
    }

    function test_isExpired_stillValid() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, block.timestamp + 100);
        assertFalse(expirations.isExpired(claimId));
    }

    function test_isExpired_afterExpiry() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        assertTrue(expirations.isExpired(claimId));
    }

    function test_isExpired_atExpiryBoundary() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, block.timestamp + 100);
        vm.warp(block.timestamp + 100);
        assertTrue(expirations.isExpired(claimId));
    }

    // ── getTimeToExpiry() ──
    function test_getTimeToExpiry_nonExpiring() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, 0);
        assertEq(expirations.getTimeToExpiry(claimId), type(uint256).max);
    }

    function test_getTimeToExpiry_exact() public {
        uint256 expiry = block.timestamp + 1000;
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, expiry);
        assertEq(expirations.getTimeToExpiry(claimId), 1000);
    }

    function test_getTimeToExpiry_expired() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, block.timestamp + 1);
        vm.warp(block.timestamp + 2);
        assertEq(expirations.getTimeToExpiry(claimId), 0);
    }

    // ── isExpiredBatch() ──
    function test_isExpiredBatch() public {
        vm.prank(issuer);
        bytes32 c1 = registry.attest(subject, schemaId, DATA, block.timestamp + 1);

        vm.warp(block.timestamp + 2);

        vm.prank(issuer);
        bytes32 c2 = registry.attest(subject, schemaId, DATA, 0);

        bytes32[] memory ids = new bytes32[](2);
        ids[0] = c1;
        ids[1] = c2;

        bool[] memory results = expirations.isExpiredBatch(ids);
        assertEq(results.length, 2);
        assertTrue(results[0]);
        assertFalse(results[1]);
    }

    function test_isExpiredBatch_empty() public {
        bytes32[] memory ids = new bytes32[](0);
        bool[] memory results = expirations.isExpiredBatch(ids);
        assertEq(results.length, 0);
    }

    // ── getClaim() (passthrough) ──
    function test_getClaim() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, block.timestamp + 100);

        Claim memory c = expirations.getClaim(claimId);
        assertEq(c.subject, subject);
        assertEq(c.dataCommitment, DATA);
        assertEq(c.expiresAt, block.timestamp + 100);
    }

    function test_getClaim_revertsOnMissing() public {
        bytes32 fakeId = keccak256("ghost");
        vm.expectRevert(abi.encodeWithSelector(ArcPass__ClaimNotFound.selector, fakeId));
        expirations.getClaim(fakeId);
    }
}

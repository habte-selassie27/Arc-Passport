// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";
import "../src/extensions/DefaultResolver.sol";
import "../src/extensions/IssuerAllowlistResolver.sol";

contract EASIntegrationTest is Test {
    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    DefaultResolver public defaultResolver;
    IssuerAllowlistResolver public allowlistResolver;

    address multisig = makeAddr("multisig");
    address issuer   = makeAddr("issuer");
    address issuer2  = makeAddr("issuer2");
    address subject  = makeAddr("subject");
    address subject2 = makeAddr("subject2");

    bytes32 constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
    bytes32 constant REVOKER_ROLE = keccak256("REVOKER_ROLE");
    bytes32 constant DATA = keccak256("data");
    bytes32 constant DATA2 = keccak256("data2");

    bytes32 schemaId;
    bytes32 schemaId2;

    function setUp() public {
        SchemaRegistry schemaImpl = new SchemaRegistry();
        ERC1967Proxy schemaProxy = new ERC1967Proxy(
            address(schemaImpl),
            abi.encodeCall(SchemaRegistry.initialize, (multisig))
        );
        schemaRegistry = SchemaRegistry(address(schemaProxy));

        AttestationRegistry attImpl = new AttestationRegistry();
        ERC1967Proxy attProxy = new ERC1967Proxy(
            address(attImpl),
            abi.encodeCall(AttestationRegistry.initialize, (multisig, address(schemaProxy)))
        );
        registry = AttestationRegistry(address(attProxy));

        defaultResolver = new DefaultResolver();
        allowlistResolver = new IssuerAllowlistResolver();

        vm.startPrank(multisig);
        registry.grantRole(ISSUER_ROLE, issuer);
        registry.grantRole(ISSUER_ROLE, issuer2);
        registry.grantRole(REVOKER_ROLE, multisig);
        vm.stopPrank();

        vm.prank(multisig);
        schemaId = schemaRegistry.registerSchema("kyc_basic", "1.0", "fields");
        vm.prank(multisig);
        schemaId2 = schemaRegistry.registerSchema("employment", "1.0", "fields");
    }

    // ── Version ──
    function test_version() public {
        assertEq(registry.version(), "1.1.0");
    }

    // ── refUID attestation ──
    function test_attestWithRef_succeeds() public {
        // First create a base attestation
        vm.prank(issuer);
        bytes32 baseClaimId = registry.attest(subject, schemaId, DATA, 0);

        // Create a referenced attestation
        vm.prank(issuer);
        bytes32 refClaimId = registry.attestWithRef(subject, schemaId2, DATA2, 0, baseClaimId);

        Claim memory c = registry.getClaim(refClaimId);
        assertEq(c.refUID, baseClaimId);
        assertFalse(c.revoked);
        assertEq(c.revokedAt, 0);
    }

    function test_attestWithRef_revertsOnInvalidRef() public {
        bytes32 fakeRef = keccak256("fake");
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(ArcPass__ClaimNotFound.selector, fakeRef));
        registry.attestWithRef(subject, schemaId, DATA, 0, fakeRef);
    }

    function test_attestWithRef_revertsOnRevokedRef() public {
        vm.prank(issuer);
        bytes32 baseClaimId = registry.attest(subject, schemaId, DATA, 0);

        // Revoke the base
        vm.prank(issuer);
        registry.revoke(baseClaimId);

        // Try to reference revoked claim
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(ArcPass__ClaimNotFound.selector, baseClaimId));
        registry.attestWithRef(subject, schemaId2, DATA2, 0, baseClaimId);
    }

    function test_attestWithRef_revertsOnExpiredRef() public {
        vm.prank(issuer);
        bytes32 baseClaimId = registry.attest(subject, schemaId, DATA, block.timestamp + 1);

        // Warp past expiry
        vm.warp(block.timestamp + 2);

        // Try to reference expired claim
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(ArcPass__ClaimNotFound.selector, baseClaimId));
        registry.attestWithRef(subject, schemaId2, DATA2, 0, baseClaimId);
    }

    function test_attestWithRef_zeroRefUID_works() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attestWithRef(subject, schemaId, DATA, 0, bytes32(0));

        Claim memory c = registry.getClaim(claimId);
        assertEq(c.refUID, bytes32(0));
    }

    // ── revokedAt tracking ──
    function test_revoke_setsRevokedAt() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, 0);

        vm.prank(issuer);
        registry.revoke(claimId);

        Claim memory c = registry.getClaim(claimId);
        assertTrue(c.revoked);
        assertEq(c.revokedAt, block.timestamp);
    }

    function test_revoke_revokedAtNonZero() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, 0);

        Claim memory before = registry.getClaim(claimId);
        assertEq(before.revokedAt, 0);

        vm.prank(issuer);
        registry.revoke(claimId);

        Claim memory after_ = registry.getClaim(claimId);
        assertTrue(after_.revokedAt > 0);
    }

    // ── Resolver ──
    function test_setResolver() public {
        vm.prank(multisig);
        registry.setResolver(address(defaultResolver));

        assertEq(registry.resolver(), address(defaultResolver));
    }

    function test_setResolver_onlyAdmin() public {
        vm.prank(issuer);
        vm.expectRevert();
        registry.setResolver(address(defaultResolver));
    }

    // ── DefaultResolver ──
    function test_defaultResolver_alwaysAllows() public {
        assertTrue(defaultResolver.beforeAttest(subject, schemaId, issuer, DATA, 0));
        assertTrue(defaultResolver.beforeRevoke(keccak256("claim"), issuer));
    }

    // ── IssuerAllowlistResolver ──
    function test_allowlistResolver_blocksUnauthorizedIssuer() public {
        allowlistResolver.allowIssuer(schemaId, issuer);

        // Allowed issuer passes
        assertTrue(allowlistResolver.beforeAttest(subject, schemaId, issuer, DATA, 0));

        // Unauthorized issuer blocked
        assertFalse(allowlistResolver.beforeAttest(subject, schemaId, issuer2, DATA, 0));
    }

    function test_allowlistResolver_removeIssuer() public {
        allowlistResolver.allowIssuer(schemaId, issuer);
        assertTrue(allowlistResolver.isAllowed(schemaId, issuer));

        allowlistResolver.removeIssuer(schemaId, issuer);
        assertFalse(allowlistResolver.isAllowed(schemaId, issuer));
    }

    function test_allowlistResolver_perSchema() public {
        allowlistResolver.allowIssuer(schemaId, issuer);

        // Allowed for schemaId
        assertTrue(allowlistResolver.isAllowed(schemaId, issuer));

        // Not allowed for schemaId2
        assertFalse(allowlistResolver.isAllowed(schemaId2, issuer));
    }

    // ── Composable attestation chain ──
    function test_attestationChain() public {
        // Chain: KYC → Employment → Reputation (each different schema)
        vm.prank(issuer);
        bytes32 kycClaim = registry.attest(subject, schemaId, DATA, 0);

        vm.prank(issuer);
        bytes32 empClaim = registry.attestWithRef(subject, schemaId2, DATA2, 0, kycClaim);

        // Use different subject to avoid ActiveClaimExists (same schemaId+issuer)
        vm.prank(issuer);
        bytes32 repClaim = registry.attestWithRef(subject2, schemaId, keccak256("repData"), 0, empClaim);

        // Verify chain
        Claim memory kyc = registry.getClaim(kycClaim);
        Claim memory emp = registry.getClaim(empClaim);
        Claim memory rep = registry.getClaim(repClaim);

        assertEq(kyc.refUID, bytes32(0));     // Root has no reference
        assertEq(emp.refUID, kycClaim);       // Employment references KYC
        assertEq(rep.refUID, empClaim);       // Reputation references Employment

        // All valid
        assertTrue(registry.isValid(kycClaim));
        assertTrue(registry.isValid(empClaim));
        assertTrue(registry.isValid(repClaim));

        // Revoke KYC — employment and reputation should still be individually valid
        vm.prank(issuer);
        registry.revoke(kycClaim);

        assertFalse(registry.isValid(kycClaim));
        assertTrue(registry.isValid(empClaim));  // Still valid (not revoked, not expired)
        assertTrue(registry.isValid(repClaim));
    }
}

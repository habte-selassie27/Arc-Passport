// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../src/extensions/DelegatedAttestation.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";

contract DelegatedAttestationTest is Test {
    event DelegationRevoked(address indexed issuer, address indexed delegate, bytes32 indexed schemaId);
    event DelegatedClaimIssued(bytes32 indexed claimId, address indexed issuer, address indexed delegate, address subject);
    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    DelegatedAttestation public delegation;

    address multisig   = makeAddr("multisig");
    uint256 issuerKey   = 0xA11CE;
    uint256 delegateKey = 0xDEAD;
    uint256 constant WRONG_KEY = 0xBEEF;
    address issuer     = vm.addr(issuerKey);
    address delegate   = vm.addr(delegateKey);
    address subject    = makeAddr("subject");
    address stranger   = makeAddr("stranger");

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
        delegation = new DelegatedAttestation(address(registry));

        vm.startPrank(multisig);
        registry.grantRole(DelegatedAttestationTest.ISSUER_ROLE, issuer);
        registry.grantRole(DelegatedAttestationTest.ISSUER_ROLE, address(delegation));
        schemaId = schemaRegistry.registerSchema("test", "1.0", "fields");
        vm.stopPrank();
    }

    // ── setDelegate() ──
    function test_setDelegate_success() public {
        vm.prank(issuer);
        delegation.setDelegate(delegate, schemaId, block.timestamp + 1000);

        DelegatedAttestation.Delegation memory d = delegation.getDelegation(issuer, delegate, schemaId);
        assertEq(d.delegate, delegate);
        assertEq(d.schemaId, schemaId);
        assertFalse(d.used);
    }

    function test_setDelegate_revertsOnZeroAddress() public {
        vm.prank(issuer);
        vm.expectRevert(ArcPass__ZeroAddress.selector);
        delegation.setDelegate(address(0), schemaId, block.timestamp + 1000);
    }

    function test_setDelegate_noExpiry() public {
        vm.prank(issuer);
        delegation.setDelegate(delegate, schemaId, 0);

        DelegatedAttestation.Delegation memory d = delegation.getDelegation(issuer, delegate, schemaId);
        assertEq(d.expiresAt, 0);
    }

    // ── revokeDelegate() ──
    function test_revokeDelegate() public {
        vm.prank(issuer);
        delegation.setDelegate(delegate, schemaId, block.timestamp + 1000);

        vm.prank(issuer);
        delegation.revokeDelegate(delegate, schemaId);

        DelegatedAttestation.Delegation memory d = delegation.getDelegation(issuer, delegate, schemaId);
        assertEq(d.delegate, address(0));
    }

    function test_revokeDelegate_emitsEvent() public {
        vm.prank(issuer);
        delegation.setDelegate(delegate, schemaId, block.timestamp + 1000);

        vm.prank(issuer);
        vm.expectEmit(true, true, true, true);
        emit DelegationRevoked(issuer, delegate, schemaId);
        delegation.revokeDelegate(delegate, schemaId);
    }

    // ── delegatedAttest() ──
    function test_delegatedAttest_success() public {
        vm.prank(issuer);
        delegation.setDelegate(delegate, schemaId, block.timestamp + 1000);

        bytes32 message = keccak256(abi.encode(subject, schemaId, DATA, 0, block.chainid));
        bytes32 ethMessage = MessageHashUtils.toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s_) = vm.sign(delegateKey, ethMessage);
        bytes memory sig = abi.encodePacked(r, s_, v);

        vm.prank(delegate);
        bytes32 claimId = delegation.delegatedAttest(subject, schemaId, DATA, 0, issuer, sig);
        assertTrue(registry.isValid(claimId));
    }

    function test_delegatedAttest_revertsIfNotDelegate() public {
        vm.prank(issuer);
        delegation.setDelegate(delegate, schemaId, block.timestamp + 1000);

        bytes32 message = keccak256(abi.encode(subject, schemaId, DATA, 0, block.chainid));
        bytes32 ethMessage = MessageHashUtils.toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s_) = vm.sign(delegateKey, ethMessage);
        bytes memory sig = abi.encodePacked(r, s_, v);

        vm.prank(stranger);
        vm.expectRevert(ArcPass__NotDelegatedSigner.selector);
        delegation.delegatedAttest(subject, schemaId, DATA, 0, issuer, sig);
    }

    function test_delegatedAttest_revertsExpiredDelegation() public {
        vm.prank(issuer);
        delegation.setDelegate(delegate, schemaId, block.timestamp + 1000);

        vm.warp(block.timestamp + 2000);

        bytes32 message = keccak256(abi.encode(subject, schemaId, DATA, 0, block.chainid));
        bytes32 ethMessage = MessageHashUtils.toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s_) = vm.sign(delegateKey, ethMessage);
        bytes memory sig = abi.encodePacked(r, s_, v);

        vm.prank(delegate);
        vm.expectRevert(ArcPass__DelegationExpired.selector);
        delegation.delegatedAttest(subject, schemaId, DATA, 0, issuer, sig);
    }

    function test_delegatedAttest_revertsBadSignature() public {
        vm.prank(issuer);
        delegation.setDelegate(delegate, schemaId, block.timestamp + 1000);

        bytes32 message = keccak256(abi.encode(subject, schemaId, DATA, 0, block.chainid));
        bytes32 ethMessage = MessageHashUtils.toEthSignedMessageHash(message);
        // Sign with WRONG_KEY instead of delegateKey
        (uint8 v, bytes32 r, bytes32 s_) = vm.sign(WRONG_KEY, ethMessage);
        bytes memory sig = abi.encodePacked(r, s_, v);

        vm.prank(delegate);
        vm.expectRevert(ArcPass__InvalidSignature.selector);
        delegation.delegatedAttest(subject, schemaId, DATA, 0, issuer, sig);
    }

    function test_delegatedAttest_emitsEvent() public {
        vm.prank(issuer);
        delegation.setDelegate(delegate, schemaId, block.timestamp + 1000);

        bytes32 message = keccak256(abi.encode(subject, schemaId, DATA, 0, block.chainid));
        bytes32 ethMessage = MessageHashUtils.toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s_) = vm.sign(delegateKey, ethMessage);
        bytes memory sig = abi.encodePacked(r, s_, v);

        vm.prank(delegate);
        vm.expectEmit(false, true, true, true);
        emit DelegatedClaimIssued(bytes32(0), issuer, delegate, subject);
        delegation.delegatedAttest(subject, schemaId, DATA, 0, issuer, sig);
    }

    // ── Single use ──
    function test_delegatedAttest_singleUse() public {
        vm.prank(issuer);
        delegation.setDelegate(delegate, schemaId, block.timestamp + 1000);

        bytes32 message = keccak256(abi.encode(subject, schemaId, DATA, 0, block.chainid));
        bytes32 ethMessage = MessageHashUtils.toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s_) = vm.sign(delegateKey, ethMessage);
        bytes memory sig = abi.encodePacked(r, s_, v);

        vm.prank(delegate);
        delegation.delegatedAttest(subject, schemaId, DATA, 0, issuer, sig);

        vm.prank(delegate);
        vm.expectRevert(ArcPass__DelegationExpired.selector);
        delegation.delegatedAttest(subject, schemaId, DATA, 0, issuer, sig);
    }

    // ── Delegation by schemaId(0) for any schema ──
    function test_delegate_anySchema() public {
        bytes32 anySchema = bytes32(0);
        vm.prank(issuer);
        delegation.setDelegate(delegate, anySchema, block.timestamp + 1000);

        bytes32 message = keccak256(abi.encode(subject, schemaId, DATA, 0, block.chainid));
        bytes32 ethMessage = MessageHashUtils.toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s_) = vm.sign(delegateKey, ethMessage);
        bytes memory sig = abi.encodePacked(r, s_, v);

        vm.prank(delegate);
        bytes32 claimId = delegation.delegatedAttest(subject, schemaId, DATA, 0, issuer, sig);
        assertTrue(registry.isValid(claimId));
    }
}

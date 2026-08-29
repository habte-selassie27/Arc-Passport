// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";
import "../src/core/PassportVerifier.sol";
import "../src/core/errors/ArcPassErrors.sol";
import "../src/services/verifiers/IdentityGate.sol";
import { OPENID3_IDENTITY_ID } from "../src/services/schemas/SchemaIds.sol";

contract IdentityGateTest is Test {
    event ClaimIssued(bytes32 indexed claimId, address indexed subject, address indexed issuer, bytes32 schemaId);
    event ClaimRevoked(bytes32 indexed claimId, address indexed revoker, uint256 timestamp);

    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    PassportVerifier public verifier;
    IdentityGate public gate;

    address multisig = makeAddr("multisig");
    address issuer   = makeAddr("issuer");
    address revoker  = makeAddr("revoker");
    address subject  = makeAddr("subject");

    bytes32 constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
    bytes32 constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    bytes32 constant DATA = keccak256("identity_commitment");

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

        verifier = new PassportVerifier(address(proxy), address(0), address(0));
        gate = new IdentityGate(address(verifier));

        vm.startPrank(multisig);
        registry.grantRole(IdentityGateTest.ISSUER_ROLE, issuer);
        registry.grantRole(IdentityGateTest.REVOKER_ROLE, revoker);
        schemaRegistry.registerSchema(
            "arcpass_openid3_identity",
            "1.0.0",
            '[{"name":"linked","type":"bool"},{"name":"provider","type":"string"},{"name":"accountHandle","type":"string"},{"name":"accountVerified","type":"bool"},{"name":"linkedAt","type":"uint64"}]'
        );
        vm.stopPrank();
    }

    function _issue() internal returns (bytes32) {
        vm.prank(issuer);
        return registry.attest(subject, OPENID3_IDENTITY_ID, DATA, 0);
    }

    // ── isIdentityLinked ──

    function test_isIdentityLinked_falseWhenNoClaim() public view {
        assertFalse(gate.isIdentityLinked(subject));
    }

    function test_requireIdentityLinked_revertsWhenNoClaim() public {
        vm.expectRevert();
        gate.requireIdentityLinked(subject);
    }

    function test_isIdentityLinked_trueAfterIssue() public {
        _issue();
        assertTrue(gate.isIdentityLinked(subject));
        gate.requireIdentityLinked(subject);
    }

    function test_isIdentityLinked_falseAfterRevoke() public {
        bytes32 claimId = _issue();
        assertTrue(gate.isIdentityLinked(subject));

        vm.prank(issuer);
        registry.revoke(claimId);

        assertFalse(gate.isIdentityLinked(subject));
    }

    function test_isIdentityLinked_falseAfterExpire() public {
        uint256 expiry = block.timestamp + 1 days;
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, OPENID3_IDENTITY_ID, DATA, expiry);
        assertTrue(gate.isIdentityLinked(subject));

        vm.warp(expiry + 1);
        assertFalse(gate.isIdentityLinked(subject));
    }

    function test_isIdentityLinked_ignoresOtherSchemas() public {
        vm.prank(multisig);
        bytes32 otherSchema = schemaRegistry.registerSchema(
            "arcpass_identity",
            "1.0.0",
            '[{"name":"displayName","type":"string"},{"name":"avatarCid","type":"string"},{"name":"createdAt","type":"uint64"}]'
        );
        vm.prank(issuer);
        registry.attest(subject, otherSchema, DATA, 0);

        assertFalse(gate.isIdentityLinked(subject));
    }
}

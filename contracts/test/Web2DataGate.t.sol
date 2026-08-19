// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";
import "../src/core/PassportVerifier.sol";
import "../src/core/errors/ArcPassErrors.sol";
import "../src/services/verifiers/Web2DataGate.sol";
import { WEB2_DATA_PROOF_ID } from "../src/services/schemas/SchemaIds.sol";

contract Web2DataGateTest is Test {
    event ClaimIssued(bytes32 indexed claimId, address indexed subject, address indexed issuer, bytes32 schemaId);
    event ClaimRevoked(bytes32 indexed claimId, address indexed revoker, uint256 timestamp);

    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    PassportVerifier public verifier;
    Web2DataGate public gate;

    address multisig = makeAddr("multisig");
    address issuer   = makeAddr("issuer");
    address revoker  = makeAddr("revoker");
    address subject  = makeAddr("subject");

    bytes32 constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
    bytes32 constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    bytes32 constant DATA = keccak256("web2_data_commitment");

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
        gate = new Web2DataGate(address(verifier));

        vm.startPrank(multisig);
        registry.grantRole(ISSUER_ROLE, issuer);
        registry.grantRole(REVOKER_ROLE, revoker);
        schemaRegistry.registerSchema(
            "arcpass_web2_data_proof",
            "1.0.0",
            '[{"name":"verified","type":"bool"},{"name":"provider","type":"string"},{"name":"templateId","type":"string"},{"name":"dataHash","type":"bytes32"},{"name":"checkedAt","type":"uint64"}]'
        );
        vm.stopPrank();
    }

    function _issue() internal returns (bytes32) {
        vm.prank(issuer);
        return registry.attest(subject, WEB2_DATA_PROOF_ID, DATA, 0);
    }

    // ── isWeb2Verified ──

    function test_isWeb2Verified_falseWhenNoClaim() public view {
        assertFalse(gate.isWeb2Verified(subject));
    }

    function test_requireWeb2Verified_revertsWhenNoClaim() public {
        vm.expectRevert();
        gate.requireWeb2Verified(subject);
    }

    function test_isWeb2Verified_trueAfterIssue() public {
        _issue();
        assertTrue(gate.isWeb2Verified(subject));
        gate.requireWeb2Verified(subject);
    }

    function test_isWeb2Verified_falseAfterRevoke() public {
        bytes32 claimId = _issue();
        assertTrue(gate.isWeb2Verified(subject));

        vm.prank(revoker);
        registry.revoke(claimId);

        assertFalse(gate.isWeb2Verified(subject));
    }

    function test_isWeb2Verified_falseAfterExpire() public {
        uint256 expiry = block.timestamp + 1 days;
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, WEB2_DATA_PROOF_ID, DATA, expiry);
        assertTrue(gate.isWeb2Verified(subject));

        vm.warp(expiry + 1);
        assertFalse(gate.isWeb2Verified(subject));
    }

    // ── wrong schema does not satisfy the gate ──

    function test_isWeb2Verified_ignoresOtherSchemas() public {
        vm.prank(multisig);
        bytes32 otherSchema = schemaRegistry.registerSchema(
            "arcpass_identity",
            "1.0.0",
            '[{"name":"displayName","type":"string"},{"name":"avatarCid","type":"string"},{"name":"createdAt","type":"uint64"}]'
        );
        vm.prank(issuer);
        registry.attest(subject, otherSchema, DATA, 0);

        assertFalse(gate.isWeb2Verified(subject));
    }
}

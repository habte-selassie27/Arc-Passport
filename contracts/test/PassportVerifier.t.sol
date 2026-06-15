// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";
import "../src/core/PassportVerifier.sol";

contract PassportVerifierTest is Test {
    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    PassportVerifier public verifier;

    address multisig = makeAddr("multisig");
    address issuer   = makeAddr("issuer");
    address subject  = makeAddr("subject");
    address subject2 = makeAddr("subject2");

    bytes32 constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    bytes32 schemaId;
    bytes32 schemaId2;
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
        verifier = new PassportVerifier(address(proxy));

        vm.startPrank(multisig);
        registry.grantRole(PassportVerifierTest.ISSUER_ROLE, issuer);
        registry.grantRole(PassportVerifierTest.REVOKER_ROLE, multisig);
        schemaId = schemaRegistry.registerSchema("kyc_basic", "1.0", "fields");
        schemaId2 = schemaRegistry.registerSchema("residence", "1.0", "fields");
        vm.stopPrank();
    }

    // ── verify() ──
    function test_verify_validClaim() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, 0);

        VerificationResult memory r = verifier.verify(subject, schemaId);
        assertTrue(r.valid);
        assertEq(r.claimId, claimId);
        assertEq(r.issuer, issuer);
        assertEq(r.dataCommitment, DATA);
    }

    function test_verify_returnsDefaultForNoClaim() public {
        VerificationResult memory r = verifier.verify(subject, schemaId);
        assertFalse(r.valid);
        assertEq(r.claimId, bytes32(0));
        assertEq(r.issuer, address(0));
    }

    function test_verify_returnsFalseForMissingSchema() public {
        vm.prank(issuer);
        registry.attest(subject, schemaId, DATA, 0);

        VerificationResult memory r = verifier.verify(subject, schemaId2);
        assertFalse(r.valid);
    }

    function test_verify_returnsFalseForUnknownSubject() public {
        vm.prank(issuer);
        registry.attest(subject, schemaId, DATA, 0);

        VerificationResult memory r = verifier.verify(subject2, schemaId);
        assertFalse(r.valid);
    }

    function test_verify_revertsOnZeroSubject() public {
        vm.expectRevert();
        verifier.verify(address(0), schemaId);
    }

    function test_verify_revokedClaim() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, 0);
        vm.prank(multisig);
        registry.revoke(claimId);

        VerificationResult memory r = verifier.verify(subject, schemaId);
        assertFalse(r.valid);
    }

    function test_verify_expiredClaim() public {
        vm.prank(issuer);
        registry.attest(subject, schemaId, DATA, block.timestamp + 1);
        vm.warp(block.timestamp + 2);

        VerificationResult memory r = verifier.verify(subject, schemaId);
        assertFalse(r.valid);
    }

    function test_verify_multipleIssuers_returnsMostRecentActive() public {
        address issuer2 = makeAddr("issuer2");
        vm.startPrank(multisig);
        registry.grantRole(PassportVerifierTest.ISSUER_ROLE, issuer2);
        vm.stopPrank();

        vm.prank(issuer);
        bytes32 claimId1 = registry.attest(subject, schemaId, DATA, 0);

        vm.prank(issuer2);
        bytes32 claimId2 = registry.attest(subject, schemaId, keccak256("data2"), 0);

        VerificationResult memory r = verifier.verify(subject, schemaId);
        assertTrue(r.valid);
        // verify returns first issuer's active claim (issuer was granted first)
        assertEq(r.claimId, claimId1);
    }

    // ── verifyMulti() ──
    function test_verifyMulti() public {
        vm.startPrank(issuer);
        bytes32 c1 = registry.attest(subject, schemaId, DATA, 0);
        bytes32 c2 = registry.attest(subject, schemaId2, DATA, 0);
        vm.stopPrank();

        bytes32[] memory schemas = new bytes32[](2);
        schemas[0] = schemaId;
        schemas[1] = schemaId2;

        VerificationResult[] memory results = verifier.verifyMulti(subject, schemas);
        assertEq(results.length, 2);
        assertTrue(results[0].valid);
        assertTrue(results[1].valid);
    }

    function test_verifyMulti_partial() public {
        vm.prank(issuer);
        registry.attest(subject, schemaId, DATA, 0);

        bytes32[] memory schemas = new bytes32[](2);
        schemas[0] = schemaId;
        schemas[1] = schemaId2;

        VerificationResult[] memory results = verifier.verifyMulti(subject, schemas);
        assertTrue(results[0].valid);
        assertFalse(results[1].valid);
    }

    function test_verifyMulti_empty() public {
        bytes32[] memory schemas = new bytes32[](0);
        VerificationResult[] memory results = verifier.verifyMulti(subject, schemas);
        assertEq(results.length, 0);
    }

    // ── verifyField() ──
    function test_verifyField_validProof() public {
        // Tree: 4 leaves [a, b, c, d]
        // Level1: H(a|b), H(c|d)
        // Root: H(H(a|b) | H(c|d))
        bytes32 a = keccak256("a");
        bytes32 b = keccak256("b");
        bytes32 c = keccak256("c");
        bytes32 d = keccak256("d");
        bytes32 n1 = keccak256(abi.encodePacked(a, b));
        bytes32 n2 = keccak256(abi.encodePacked(c, d));
        bytes32 root = keccak256(abi.encodePacked(n1, n2));

        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, root, 0);

        // Proof for leaf a (index 0): [b, n2]
        bytes32[] memory proof = new bytes32[](2);
        proof[0] = b;
        proof[1] = n2;

        assertTrue(verifier.verifyField(claimId, a, proof, 0));
    }

    function test_verifyField_invalidProof() public {
        bytes32 leaf  = keccak256("field1");
        bytes32 root  = keccak256("real_root");

        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, root, 0);

        bytes32[] memory proof = new bytes32[](0);
        assertFalse(verifier.verifyField(claimId, leaf, proof, 0));
    }

    function test_verifyField_revertsIfRevoked() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, keccak256("root"), 0);
        vm.startPrank(multisig);
        registry.revoke(claimId);

        bytes32[] memory proof = new bytes32[](0);
        vm.expectRevert(abi.encodeWithSelector(ArcPass__ClaimAlreadyRevoked.selector, claimId));
        verifier.verifyField(claimId, keccak256("x"), proof, 0);
    }

    function test_verifyField_revertsIfExpired() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, keccak256("root"), block.timestamp + 1);
        vm.warp(block.timestamp + 2);

        bytes32[] memory proof = new bytes32[](0);
        vm.expectRevert();
        verifier.verifyField(claimId, keccak256("x"), proof, 0);
    }

    // ── Merkle proof right-branch ──
    function test_verifyField_rightChildProof() public {
        // Tree: 4 leaves [a, b, c, d]
        // Level1: H(a|b), H(c|d)
        // Root: H(H(a|b) | H(c|d))
        bytes32 a = keccak256("a");
        bytes32 b = keccak256("b");
        bytes32 c = keccak256("c");
        bytes32 d = keccak256("d");
        bytes32 n1 = keccak256(abi.encodePacked(a, b));
        bytes32 n2 = keccak256(abi.encodePacked(c, d));
        bytes32 root = keccak256(abi.encodePacked(n1, n2));

        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, root, 0);

        // Proof for leaf d (index 3): [c, n1]
        bytes32[] memory proof = new bytes32[](2);
        proof[0] = c;
        proof[1] = n1;

        assertTrue(verifier.verifyField(claimId, d, proof, 3));
    }
}

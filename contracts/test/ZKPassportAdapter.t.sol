// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AttestationRegistry} from "../src/core/AttestationRegistry.sol";
import {Claim} from "../src/core/interfaces/IAttestationRegistry.sol";
import {SchemaRegistry} from "../src/core/SchemaRegistry.sol";
import {PassportVerifier} from "../src/core/PassportVerifier.sol";
import {VerificationResult} from "../src/core/interfaces/IPassportVerifier.sol";
import {ZKVerifier} from "../src/services/verifiers/ZKVerifier.sol";
import {ZKPassportAdapter} from "../src/services/verifiers/ZKPassportAdapter.sol";
import {MockGroth16Verifier} from "../src/services/verifiers/MockGroth16Verifier.sol";
import {
    PASSPORT_AUTHENTICITY_ID,
    ZK_ATTRIBUTE_PROOF_ID
} from "../src/services/schemas/SchemaIds.sol";

contract ZKPassportAdapterTest is Test {
    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    PassportVerifier public verifier;
    ZKVerifier public zkVerifier;
    MockGroth16Verifier public mockVerifier;
    ZKPassportAdapter public adapter;

    address multisig = makeAddr("multisig");
    address user = makeAddr("user");
    address user2 = makeAddr("user2");

    bytes32 constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    function setUp() public {
        // Deploy core contracts
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

        // Register ZK schemas
        vm.startPrank(multisig);
        string memory authFields = '[{\"name\":\"documentType\",\"type\":\"string\"},{\"name\":\"issuerCountry\",\"type\":\"string\"},{\"name\":\"issuingAuthority\",\"type\":\"string\"},{\"name\":\"documentNumber\",\"type\":\"string\"},{\"name\":\"issuedAt\",\"type\":\"uint64\"},{\"name\":\"expiresAt\",\"type\":\"uint64\"},{\"name\":\"verified\",\"type\":\"bool\"},{\"name\":\"proofHash\",\"type\":\"bytes32\"}]';
        string memory attrFields = '[{\"name\":\"attributeType\",\"type\":\"string\"},{\"name\":\"attributeHash\",\"type\":\"bytes32\"},{\"name\":\"circuitId\",\"type\":\"string\"},{\"name\":\"verified\",\"type\":\"bool\"},{\"name\":\"proofHash\",\"type\":\"bytes32\"},{\"name\":\"verifiedAt\",\"type\":\"uint64\"}]';
        schemaRegistry.registerSchema("arcpass_passport_authenticity", "1.0.0", authFields);
        schemaRegistry.registerSchema("arcpass_zk_attribute_proof", "1.0.0", attrFields);
        vm.stopPrank();

        // Deploy ZK infrastructure
        vm.startPrank(multisig);
        zkVerifier = new ZKVerifier();
        mockVerifier = new MockGroth16Verifier(true);
        uint16 verifierId = zkVerifier.addVerifier(address(mockVerifier), "Mock Groth16");

        adapter = new ZKPassportAdapter(
            address(registry),
            address(zkVerifier),
            PASSPORT_AUTHENTICITY_ID,
            ZK_ATTRIBUTE_PROOF_ID
        );

        // Grant adapter ISSUER_ROLE so it can call attest()
        registry.grantRole(ISSUER_ROLE, address(adapter));
        vm.stopPrank();

        // Configure trusted document types
        vm.startPrank(multisig);
        adapter.setDocumentType("passport", true);
        adapter.setDocumentType("national_id", true);
        vm.stopPrank();
    }

    // ── Document Type Management ─────────────────────────────────────────

    function test_setDocumentType_success() public {
        vm.prank(multisig);
        adapter.setDocumentType("drivers_license", true);
        assertTrue(adapter.trustedDocumentTypes("drivers_license"));
    }

    function test_setDocumentType_revertForNonOwner() public {
        vm.prank(user);
        vm.expectRevert();
        adapter.setDocumentType("passport", true);
    }

    // ── Layer 1: Passport Authenticity ───────────────────────────────────

    function test_submitProof_success() public {
        // Warp to a future time so block.timestamp - 1 days doesn't underflow
        vm.warp(30 days);
        bytes memory proof = abi.encodePacked(hex"abcd");
        bytes32 proofHash = keccak256("passport_proof_1");

        vm.prank(user);
        bytes32 claimId = adapter.submitProof(
            0, // verifierId
            proof,
            new uint256[](0),
            proofHash,
            "passport",
            block.timestamp - 1 days,
            0 // no expiry
        );

        assertTrue(claimId != bytes32(0));
        assertTrue(registry.isValid(claimId));

        // Verify the claim was issued to the correct subject
        Claim memory c = registry.getClaim(claimId);
        assertEq(c.subject, user);
        assertEq(c.schemaId, PASSPORT_AUTHENTICITY_ID);
        assertFalse(c.revoked);
    }

    function test_submitProof_revertForUntrustedDocument() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(
            ZKPassportAdapter.ZKPass__UntrustedDocumentType.selector, "fake_doc"
        ));
        adapter.submitProof(
            0, abi.encodePacked(hex"ab"), new uint256[](0),
            keccak256("x"), "fake_doc", block.timestamp, 0
        );
    }

    function test_submitProof_revertForExpiredProof() public {
        // Warp to a future time so block.timestamp - 8 days doesn't underflow
        vm.warp(30 days);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(
            ZKPassportAdapter.ZKPass__ProofTooOld.selector,
            block.timestamp - 8 days,
            7 days
        ));
        adapter.submitProof(
            0, abi.encodePacked(hex"ab"), new uint256[](0),
            keccak256("x"), "passport", block.timestamp - 8 days, 0
        );
    }

    function test_submitProof_revertForFailedVerification() public {
        vm.startPrank(multisig);
        mockVerifier.setShouldPass(false);
        vm.stopPrank();

        vm.prank(user);
        vm.expectRevert();
        adapter.submitProof(
            0, abi.encodePacked(hex"ab"), new uint256[](0),
            keccak256("x"), "passport", block.timestamp, 0
        );
    }

    function test_submitProof_withExpiry() public {
        vm.prank(user);
        bytes32 claimId = adapter.submitProof(
            0, abi.encodePacked(hex"cd"), new uint256[](0),
            keccak256("proof2"), "national_id",
            block.timestamp,
            block.timestamp + 365 days
        );

        Claim memory c = registry.getClaim(claimId);
        assertTrue(c.expiresAt > c.issuedAt);
    }

    // ── Layer 2: ZK Attribute Proof ─────────────────────────────────────

    function test_submitAttributeProof_success() public {
        bytes32 proofHash = keccak256("attr_proof_1");
        bytes32 attributeHash = keccak256("age >= 18");

        vm.prank(user);
        bytes32 claimId = adapter.submitAttributeProof(
            0,
            abi.encodePacked(hex"ef"),
            new uint256[](0),
            proofHash,
            attributeHash,
            0
        );

        assertTrue(claimId != bytes32(0));
        assertTrue(registry.isValid(claimId));

        Claim memory c = registry.getClaim(claimId);
        assertEq(c.subject, user);
        assertEq(c.schemaId, ZK_ATTRIBUTE_PROOF_ID);
    }

    function test_submitAttributeProof_revertForFailedVerification() public {
        vm.startPrank(multisig);
        mockVerifier.setShouldPass(false);
        vm.stopPrank();

        vm.prank(user);
        vm.expectRevert();
        adapter.submitAttributeProof(
            0, abi.encodePacked(hex"ab"), new uint256[](0),
            keccak256("x"), keccak256("attr"), 0
        );
    }

    // ── Dual-Layer Integration ───────────────────────────────────────────

    function test_dualLayer_userGetsTwoAttestations() public {
        // Layer 1: Passport authenticity
        vm.prank(user);
        bytes32 authClaim = adapter.submitProof(
            0, abi.encodePacked(hex"aa"), new uint256[](0),
            keccak256("auth"), "passport", block.timestamp, 0
        );

        // Layer 2: ZK attribute proof (age >= 18)
        vm.prank(user);
        bytes32 attrClaim = adapter.submitAttributeProof(
            0, abi.encodePacked(hex"bb"), new uint256[](0),
            keccak256("attr"), keccak256("age >= 18"), 0
        );

        assertTrue(registry.isValid(authClaim));
        assertTrue(registry.isValid(attrClaim));

        // Verify they are different claims with different schemas
        Claim memory c1 = registry.getClaim(authClaim);
        Claim memory c2 = registry.getClaim(attrClaim);
        assertTrue(c1.schemaId != c2.schemaId);
    }

    function test_dualLayer_twoUsersCanVerify() public {
        // User 1 submits passport authenticity
        vm.prank(user);
        bytes32 claim1 = adapter.submitProof(
            0, abi.encodePacked(hex"11"), new uint256[](0),
            keccak256("proof_user1"), "passport", block.timestamp, 0
        );

        // User 2 submits attribute proof
        vm.prank(user2);
        bytes32 claim2 = adapter.submitAttributeProof(
            0, abi.encodePacked(hex"22"), new uint256[](0),
            keccak256("proof_user2"), keccak256("nationality = US"), 0
        );

        // Both are valid
        assertTrue(registry.isValid(claim1));
        assertTrue(registry.isValid(claim2));

        // PassportVerifier can verify both
        VerificationResult memory r1 = verifier.verify(user, PASSPORT_AUTHENTICITY_ID);
        VerificationResult memory r2 = verifier.verify(user2, ZK_ATTRIBUTE_PROOF_ID);
        assertTrue(r1.valid);
        assertTrue(r2.valid);
    }

    function test_replayProtection_sameProofHashTwice() public {
        bytes32 proofHash = keccak256("unique_proof");

        vm.prank(user);
        adapter.submitProof(
            0, abi.encodePacked(hex"aa"), new uint256[](0),
            proofHash, "passport", block.timestamp, 0
        );

        // Same proofHash should fail (replay protection in ZKVerifier)
        vm.prank(user);
        vm.expectRevert();
        adapter.submitProof(
            0, abi.encodePacked(hex"aa"), new uint256[](0),
            proofHash, "passport", block.timestamp, 0
        );
    }
}

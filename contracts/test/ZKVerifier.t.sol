// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AttestationRegistry} from "../src/core/AttestationRegistry.sol";
import {SchemaRegistry} from "../src/core/SchemaRegistry.sol";
import {PassportVerifier} from "../src/core/PassportVerifier.sol";
import {ZKVerifier} from "../src/services/verifiers/ZKVerifier.sol";
import {ZKPassportAdapter} from "../src/services/verifiers/ZKPassportAdapter.sol";
import {MockGroth16Verifier} from "../src/services/verifiers/MockGroth16Verifier.sol";
import {PASSPORT_AUTHENTICITY_ID, ZK_ATTRIBUTE_PROOF_ID} from "../src/services/schemas/SchemaIds.sol";

contract ZKVerifierTest is Test {
    ZKVerifier public zkVerifier;
    MockGroth16Verifier public mockVerifier;

    address user = makeAddr("user");

    function setUp() public {
        zkVerifier = new ZKVerifier();
        mockVerifier = new MockGroth16Verifier(true);
    }

    // ── Verifier Management ──────────────────────────────────────────────

    function test_addVerifier_success() public {
        uint16 id = zkVerifier.addVerifier(address(mockVerifier), "Mock Groth16 v1");
        assertEq(id, 0);

        (address backend, string memory name, , bool active) = zkVerifier.verifiers(0);
        assertEq(backend, address(mockVerifier));
        assertEq(name, "Mock Groth16 v1");
        assertTrue(active);
    }

    function test_addVerifier_revertsForNonOwner() public {
        vm.prank(user);
        vm.expectRevert();
        zkVerifier.addVerifier(address(mockVerifier), "Mock");
    }

    function test_addVerifier_revertsForZeroAddress() public {
        vm.expectRevert();
        zkVerifier.addVerifier(address(0), "Zero");
    }

    function test_addVerifier_multipleVerifiers() public {
        MockGroth16Verifier v2 = new MockGroth16Verifier(false);
        zkVerifier.addVerifier(address(mockVerifier), "Verifier A");
        zkVerifier.addVerifier(address(v2), "Verifier B");

        assertEq(zkVerifier.verifierCount(), 2);
        assertEq(zkVerifier.verifierIds(0), 0);
        assertEq(zkVerifier.verifierIds(1), 1);
    }

    function test_deactivateVerifier_success() public {
        uint16 id = zkVerifier.addVerifier(address(mockVerifier), "Mock");
        zkVerifier.deactivateVerifier(id);

        (, , , bool active) = zkVerifier.verifiers(id);
        assertFalse(active);
    }

    function test_deactivateVerifier_revertsForNonOwner() public {
        uint16 id = zkVerifier.addVerifier(address(mockVerifier), "Mock");
        vm.prank(user);
        vm.expectRevert();
        zkVerifier.deactivateVerifier(id);
    }

    function test_deactivateVerifier_revertsForNonexistent() public {
        vm.expectRevert(abi.encodeWithSelector(ZKVerifier.ZKPass__VerifierNotFound.selector, 999));
        zkVerifier.deactivateVerifier(999);
    }

    // ── Proof Verification ───────────────────────────────────────────────

    function test_verifyProof_success() public {
        uint16 id = zkVerifier.addVerifier(address(mockVerifier), "Mock");

        bytes32 proofHash = keccak256("proof1");
        bytes memory proof = abi.encodePacked(hex"abcd");

        vm.prank(user);
        bool valid = zkVerifier.verifyProof(
            id,
            proof,
            new uint256[](0),
            user,
            proofHash
        );

        assertTrue(valid);
        assertTrue(zkVerifier.proofUsed(proofHash));
        assertEq(zkVerifier.totalProofsVerified(), 1);
    }

    function test_verifyProof_revertsForVerifierNotFound() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ZKVerifier.ZKPass__VerifierNotFound.selector, 999));
        zkVerifier.verifyProof(999, "proof", new uint256[](0), user, keccak256("x"));
    }

    function test_verifyProof_revertsForInactiveVerifier() public {
        uint16 id = zkVerifier.addVerifier(address(mockVerifier), "Mock");
        zkVerifier.deactivateVerifier(id);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ZKVerifier.ZKPass__VerifierInactive.selector, id));
        zkVerifier.verifyProof(id, "proof", new uint256[](0), user, keccak256("x"));
    }

    function test_verifyProof_revertsForReplay() public {
        uint16 id = zkVerifier.addVerifier(address(mockVerifier), "Mock");

        bytes32 proofHash = keccak256("proof1");

        vm.prank(user);
        zkVerifier.verifyProof(id, "proof", new uint256[](0), user, proofHash);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ZKVerifier.ZKPass__ProofAlreadyUsed.selector, proofHash));
        zkVerifier.verifyProof(id, "proof", new uint256[](0), user, proofHash);
    }

    function test_verifyProof_revertsWhenMockFails() public {
        mockVerifier.setShouldPass(false);
        uint16 id = zkVerifier.addVerifier(address(mockVerifier), "Mock");

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(
            ZKVerifier.ZKPass__ProofVerificationFailed.selector, id
        ));
        zkVerifier.verifyProof(id, "proof", new uint256[](0), user, keccak256("x"));
    }

    function test_isProofUsed() public {
        assertFalse(zkVerifier.isProofUsed(keccak256("unused")));
        uint16 id = zkVerifier.addVerifier(address(mockVerifier), "Mock");
        bytes32 proofHash = keccak256("used");
        vm.prank(user);
        zkVerifier.verifyProof(id, "proof", new uint256[](0), user, proofHash);

        assertTrue(zkVerifier.isProofUsed(proofHash));
    }

    function test_getActiveVerifierIds() public {
        uint16 id0 = zkVerifier.addVerifier(address(mockVerifier), "Active");
        MockGroth16Verifier v2 = new MockGroth16Verifier(true);
        uint16 id1 = zkVerifier.addVerifier(address(v2), "Will Deactivate");
        zkVerifier.deactivateVerifier(id1);

        uint16[] memory active = zkVerifier.getActiveVerifierIds();
        assertEq(active.length, 1);
        assertEq(active[0], id0);
    }

    // ── Dual-layer model ─────────────────────────────────────────────────

    function test_dualLayer_twoProofsForSameUser() public {
        uint16 id = zkVerifier.addVerifier(address(mockVerifier), "Mock");

        bytes32 proof1 = keccak256("auth_proof");
        bytes32 proof2 = keccak256("attr_proof");

        vm.prank(user);
        zkVerifier.verifyProof(id, "auth", new uint256[](0), user, proof1);

        vm.prank(user);
        zkVerifier.verifyProof(id, "attr", new uint256[](0), user, proof2);

        assertEq(zkVerifier.totalProofsVerified(), 2);
    }
}

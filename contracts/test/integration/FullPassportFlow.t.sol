// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../../src/core/AttestationRegistry.sol";
import "../../src/core/SchemaRegistry.sol";
import "../../src/core/PassportVerifier.sol";
import "../../src/extensions/BatchAttestation.sol";
import "../../src/extensions/DelegatedAttestation.sol";
import "../../src/extensions/ExpiringClaims.sol";

contract FullPassportFlowTest is Test {
    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    PassportVerifier public verifier;
    BatchAttestation public batcher;
    DelegatedAttestation public delegation;
    ExpiringClaims public expirationChecker;

    address multisig = makeAddr("multisig");
    address issuer   = makeAddr("issuer");
    address subject  = makeAddr("subject");

    bytes32 constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
    bytes32 constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    bytes32 schemaId;
    bytes32 constant DATA = keccak256("kyc_data");

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
        batcher = new BatchAttestation(address(proxy));
        delegation = new DelegatedAttestation(address(proxy));
        expirationChecker = new ExpiringClaims(address(proxy));

        vm.startPrank(multisig);
        registry.grantRole(FullPassportFlowTest.ISSUER_ROLE, issuer);
        registry.grantRole(FullPassportFlowTest.ISSUER_ROLE, address(batcher));
        registry.grantRole(FullPassportFlowTest.ISSUER_ROLE, address(delegation));
        registry.grantRole(FullPassportFlowTest.REVOKER_ROLE, multisig);
        schemaId = schemaRegistry.registerSchema("kyc_basic", "1.0", "fields");
        vm.stopPrank();
    }

    function test_fullLifecycle_issueVerifyRevoke() public {
        // 1. Issue
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, 0);

        // 2. Verify via verifier
        VerificationResult memory vr = verifier.verify(subject, schemaId);
        assertTrue(vr.valid);
        assertEq(vr.claimId, claimId);
        assertEq(vr.dataCommitment, DATA);

        // 3. Verify via registry directly
        assertTrue(registry.isValid(claimId));

        // 4. Verify via ExpiringClaims
        assertFalse(expirationChecker.isExpired(claimId));

        // 5. Revoke
        vm.prank(multisig);
        registry.revoke(claimId);

        // 6. Verify invalid
        assertFalse(registry.isValid(claimId));
        vr = verifier.verify(subject, schemaId);
        assertFalse(vr.valid);
    }

    function test_batchAndDelegate() public {
        uint256 delegateKey = 0xDEADBEEF;
        address delegateAddr = vm.addr(delegateKey);
        address sub2 = makeAddr("sub2");

        // Setup delegation
        vm.prank(issuer);
        delegation.setDelegate(delegateAddr, schemaId, block.timestamp + 1000);

        // Batch attest by issuer
        AttestationInput[] memory inputs = new AttestationInput[](2);
        inputs[0] = AttestationInput(subject, schemaId, DATA, 0);
        inputs[1] = AttestationInput(sub2, schemaId, DATA, 0);

        vm.prank(issuer);
        (bytes32[] memory batchIds, bool[] memory ok) = batcher.batchAttest(inputs);
        assertTrue(ok[0]);
        assertTrue(ok[1]);

        // Delegate attest
        bytes32 message = keccak256(abi.encode(subject, schemaId, keccak256("delegated"), 0, block.chainid));
        bytes32 ethMessage = MessageHashUtils.toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(delegateKey, ethMessage);
        vm.prank(delegateAddr);
        bytes32 delClaimId = delegation.delegatedAttest(subject, schemaId, keccak256("delegated"), 0, issuer, abi.encodePacked(r, s, v));
        assertTrue(registry.isValid(delClaimId));

        // Verify all
        assertTrue(registry.isValid(batchIds[0]));
        assertTrue(registry.isValid(batchIds[1]));
        assertTrue(registry.isValid(delClaimId));
    }

    function test_multiSchemaVerify() public {
        bytes32 schema2;
        {
            vm.prank(multisig);
            schema2 = schemaRegistry.registerSchema("residence", "1.0", "fields");
        }

        vm.startPrank(issuer);
        bytes32 c1 = registry.attest(subject, schemaId, DATA, 0);
        bytes32 c2 = registry.attest(subject, schema2, DATA, 0);
        vm.stopPrank();

        bytes32[] memory schemas = new bytes32[](2);
        schemas[0] = schemaId;
        schemas[1] = schema2;

        VerificationResult[] memory results = verifier.verifyMulti(subject, schemas);
        assertEq(results[0].claimId, c1);
        assertEq(results[1].claimId, c2);
        assertTrue(results[0].valid);
        assertTrue(results[1].valid);
    }

    function test_expiryAndBatchExpiry() public {
        vm.prank(issuer);
        bytes32 c1 = registry.attest(subject, schemaId, DATA, block.timestamp + 100);

        vm.warp(block.timestamp + 200);

        vm.prank(issuer);
        bytes32 c2 = registry.attest(subject, schemaId, DATA, 0);

        bytes32[] memory ids = new bytes32[](2);
        ids[0] = c1;
        ids[1] = c2;

        bool[] memory expired = expirationChecker.isExpiredBatch(ids);
        assertTrue(expired[0]);
        assertFalse(expired[1]);

        assertEq(expirationChecker.getTimeToExpiry(c1), 0);
        assertEq(expirationChecker.getTimeToExpiry(c2), type(uint256).max);
    }

    function test_upgradeFullFlow() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, 0);

        // Revoke first so second issuance is allowed
        vm.prank(multisig);
        registry.revoke(claimId);

        AttestationRegistry v2 = new AttestationRegistry();
        vm.prank(multisig);
        AttestationRegistry(address(registry)).upgradeToAndCall(address(v2), "");

        // Claim is revoked but should still be readable
        assertFalse(registry.isValid(claimId));

        // Issue new claim on upgraded contract
        vm.prank(issuer);
        bytes32 claimId2 = registry.attest(subject, schemaId, DATA, 0);
        assertTrue(registry.isValid(claimId2));
        assertNotEq(claimId, claimId2);
    }

    function test_merkleSelectiveDisclosure() public {
        // Tree: 4 leaves [a, b, c, d]
        // Level1: H(a|b), H(c|d)
        // Root: H(H(a|b) | H(c|d))
        bytes32 a = keccak256("age_over_18");
        bytes32 b = keccak256("country_ET");
        bytes32 c = keccak256("city_AA");
        bytes32 d = keccak256("name_JD");
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
        // Wrong leaf should fail
        assertFalse(verifier.verifyField(claimId, c, proof, 2));
    }
}

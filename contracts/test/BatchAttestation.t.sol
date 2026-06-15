// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/extensions/BatchAttestation.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";

contract BatchAttestationTest is Test {
    event BatchIssued(uint256 count, address indexed issuer, uint256 timestamp);
    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    BatchAttestation public batcher;

    address multisig = makeAddr("multisig");
    address issuer   = makeAddr("issuer");
    address subA     = makeAddr("subA");
    address subB     = makeAddr("subB");

    bytes32 constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

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
        batcher = new BatchAttestation(address(registry));

        vm.startPrank(multisig);
        registry.grantRole(BatchAttestationTest.ISSUER_ROLE, issuer);
        registry.grantRole(BatchAttestationTest.ISSUER_ROLE, address(batcher));
        registry.grantRole(BatchAttestationTest.REVOKER_ROLE, multisig);
        schemaId = schemaRegistry.registerSchema("test", "1.0", "fields");
        vm.stopPrank();
    }

    function test_batchAttest_twoSubjects() public {
        AttestationInput[] memory inputs = new AttestationInput[](2);
        inputs[0] = AttestationInput(subA, schemaId, DATA, 0);
        inputs[1] = AttestationInput(subB, schemaId, DATA, 0);

        vm.prank(issuer);
        (bytes32[] memory ids, bool[] memory ok) = batcher.batchAttest(inputs);

        assertEq(ids.length, 2);
        assertEq(ok.length, 2);
        assertTrue(ok[0]);
        assertTrue(ok[1]);
        assertTrue(registry.isValid(ids[0]));
        assertTrue(registry.isValid(ids[1]));
    }

    function test_batchAttest_partialFailure() public {
        AttestationInput[] memory inputs = new AttestationInput[](2);
        inputs[0] = AttestationInput(subA, schemaId, DATA, 0);
        inputs[1] = AttestationInput(address(0), schemaId, DATA, 0);

        vm.prank(issuer);
        (bytes32[] memory ids, bool[] memory ok) = batcher.batchAttest(inputs);

        assertTrue(ok[0]);
        assertFalse(ok[1]);
        assertTrue(registry.isValid(ids[0]));
    }

    function test_batchAttest_revertsOnEmptyBatch() public {
        AttestationInput[] memory inputs = new AttestationInput[](0);
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(ArcPass__InvalidBatchSize.selector, 0));
        batcher.batchAttest(inputs);
    }

    function test_batchAttest_revertsOnOver100() public {
        AttestationInput[] memory inputs = new AttestationInput[](101);
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(ArcPass__InvalidBatchSize.selector, 101));
        batcher.batchAttest(inputs);
    }

    function test_batchAttest_emitsBatchEvent() public {
        AttestationInput[] memory inputs = new AttestationInput[](1);
        inputs[0] = AttestationInput(subA, schemaId, DATA, 0);

        vm.prank(issuer);
        vm.expectEmit(true, true, false, true);
        emit BatchIssued(1, issuer, block.timestamp);
        batcher.batchAttest(inputs);
    }

    function test_batchAttest_revertsIfNotIssuer() public {
        AttestationInput[] memory inputs = new AttestationInput[](1);
        inputs[0] = AttestationInput(subA, schemaId, DATA, 0);

        vm.prank(makeAddr("stranger"));
        vm.expectRevert(abi.encodeWithSelector(ArcPass__NotIssuer.selector, makeAddr("stranger")));
        batcher.batchAttest(inputs);
    }

    function test_batchAttest_allFailOnBadSchema() public {
        AttestationInput[] memory inputs = new AttestationInput[](1);
        inputs[0] = AttestationInput(subA, keccak256("fake"), DATA, 0);

        vm.prank(issuer);
        (bytes32[] memory ids, bool[] memory ok) = batcher.batchAttest(inputs);
        assertFalse(ok[0]);
    }

    function test_batchAttest_reusesAfterRevoke() public {
        vm.prank(issuer);
        bytes32 c1 = registry.attest(subA, schemaId, DATA, 0);

        vm.prank(multisig);
        registry.revoke(c1);

        AttestationInput[] memory inputs = new AttestationInput[](1);
        inputs[0] = AttestationInput(subA, schemaId, DATA, 0);

        vm.prank(issuer);
        (bytes32[] memory ids, bool[] memory ok) = batcher.batchAttest(inputs);
        assertTrue(ok[0]);
    }
}

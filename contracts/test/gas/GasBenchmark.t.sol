// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/core/AttestationRegistry.sol";
import "../../src/core/SchemaRegistry.sol";
import "../../src/extensions/BatchAttestation.sol";

/// @notice Gas benchmark tests for ArcPass core functions.
///         Run with: forge test --match-contract GasBenchmark -vvv
contract GasBenchmark is Test {
    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    BatchAttestation public batcher;

    address multisig = makeAddr("multisig");
    address issuer   = makeAddr("issuer");
    address subject  = makeAddr("subject");

    bytes32 constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
    bytes32 constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    bytes32 schemaId;
    bytes32 constant DATA = keccak256("benchmark_data");

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
        registry.grantRole(GasBenchmark.ISSUER_ROLE, issuer);
        registry.grantRole(GasBenchmark.REVOKER_ROLE, multisig);
        schemaId = schemaRegistry.registerSchema("bench", "1.0", "fields");
        vm.stopPrank();
    }

    function test_gas_attest() public {
        vm.prank(issuer);
        registry.attest(subject, schemaId, DATA, 0);
    }

    function test_gas_revoke() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, DATA, 0);

        vm.prank(multisig);
        registry.revoke(claimId);
    }

    function test_gas_verify() public view {
        registry.isValid(keccak256("nonexistent"));
    }

    function test_gas_batchAttest_1() public {
        AttestationInput[] memory inputs = new AttestationInput[](1);
        inputs[0] = AttestationInput(subject, schemaId, DATA, 0);
        vm.prank(issuer);
        batcher.batchAttest(inputs);
    }

    function test_gas_batchAttest_10() public {
        AttestationInput[] memory inputs = new AttestationInput[](10);
        for (uint i = 0; i < 10; i++) {
            inputs[i] = AttestationInput(makeAddr(vm.toString(i)), schemaId, DATA, 0);
        }
        vm.prank(issuer);
        batcher.batchAttest(inputs);
    }

    function test_gas_batchAttest_25() public {
        AttestationInput[] memory inputs = new AttestationInput[](25);
        for (uint i = 0; i < 25; i++) {
            inputs[i] = AttestationInput(makeAddr(vm.toString(i)), schemaId, DATA, 0);
        }
        vm.prank(issuer);
        batcher.batchAttest(inputs);
    }

    function test_gas_batchAttest_50() public {
        AttestationInput[] memory inputs = new AttestationInput[](50);
        for (uint i = 0; i < 50; i++) {
            inputs[i] = AttestationInput(makeAddr(vm.toString(i)), schemaId, DATA, 0);
        }
        vm.prank(issuer);
        batcher.batchAttest(inputs);
    }

    function test_gas_batchAttest_100() public {
        AttestationInput[] memory inputs = new AttestationInput[](100);
        for (uint i = 0; i < 100; i++) {
            inputs[i] = AttestationInput(makeAddr(vm.toString(i)), schemaId, DATA, 0);
        }
        vm.prank(issuer);
        batcher.batchAttest(inputs);
    }

    function test_gas_registerSchema() public {
        schemaRegistry.registerSchema("new_schema", "1.0", "fields");
    }
}

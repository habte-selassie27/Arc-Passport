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

/// @notice End-to-end integration test simulating real-world ArcPass usage.
contract ArcNativeIntegration is Test {
    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    PassportVerifier public verifier;
    BatchAttestation public batcher;
    DelegatedAttestation public delegator;
    ExpiringClaims public expirations;

    address multisig = makeAddr("protocoldao.eth");
    address issuerKYC = makeAddr("kyc_provider.eth");
    address issuerEmployer = makeAddr("employer.eth");
    address userAlice = makeAddr("alice.eth");
    address userBob = makeAddr("bob.eth");

    bytes32 constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
    bytes32 constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    bytes32 kycSchema;
    bytes32 employSchema;
    bytes32 residenceSchema;
    bytes32 constant KYC_DATA = keccak256("kyc_level_3_country_ET");
    bytes32 constant EMPLOY_DATA = keccak256("employer_acme_corp");

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

        verifier = new PassportVerifier(address(attProxy));
        batcher = new BatchAttestation(address(attProxy));
        delegator = new DelegatedAttestation(address(attProxy));
        expirations = new ExpiringClaims(address(attProxy));

        vm.startPrank(multisig);
        registry.grantRole(ArcNativeIntegration.ISSUER_ROLE, issuerKYC);
        registry.grantRole(ArcNativeIntegration.ISSUER_ROLE, issuerEmployer);
        registry.grantRole(ArcNativeIntegration.ISSUER_ROLE, address(batcher));
        registry.grantRole(ArcNativeIntegration.ISSUER_ROLE, address(delegator));
        registry.grantRole(ArcNativeIntegration.REVOKER_ROLE, multisig);

        kycSchema = schemaRegistry.registerSchema("kyc_basic", "1.0", "level,country");
        employSchema = schemaRegistry.registerSchema("employment", "1.0", "employer,title");
        residenceSchema = schemaRegistry.registerSchema("residence", "1.0", "country");
        vm.stopPrank();
    }

    function test_e2e_aliceFullJourney() public {
        // Alice gets KYC attestation from KYC provider
        vm.prank(issuerKYC);
        bytes32 kycClaim = registry.attest(userAlice, kycSchema, KYC_DATA, block.timestamp + 365 days);

        // Alice gets employment attestation from employer
        vm.prank(issuerEmployer);
        bytes32 employClaim = registry.attest(userAlice, employSchema, EMPLOY_DATA, block.timestamp + 180 days);

        // Verify Alice has valid KYC
        VerificationResult memory kycResult = verifier.verify(userAlice, kycSchema);
        assertTrue(kycResult.valid);
        assertEq(kycResult.issuer, issuerKYC);

        // Verify Alice has valid employment
        VerificationResult memory empResult = verifier.verify(userAlice, employSchema);
        assertTrue(empResult.valid);
        assertEq(empResult.issuer, issuerEmployer);

        // Batch verify both
        bytes32[] memory schemas = new bytes32[](2);
        schemas[0] = kycSchema;
        schemas[1] = employSchema;
        VerificationResult[] memory results = verifier.verifyMulti(userAlice, schemas);
        assertTrue(results[0].valid);
        assertTrue(results[1].valid);

        // Bob has NO claims
        VerificationResult memory bob = verifier.verify(userBob, kycSchema);
        assertFalse(bob.valid);

        // Check expiry: KYC has 365 days, employment has 180 days
        assertFalse(expirations.isExpired(kycClaim));
        assertFalse(expirations.isExpired(employClaim));
        assertTrue(expirations.getTimeToExpiry(employClaim) <= expirations.getTimeToExpiry(kycClaim));

        // Fast forward past employment expiry
        vm.warp(block.timestamp + 200 days);
        assertFalse(expirations.isExpired(kycClaim));
        assertTrue(expirations.isExpired(employClaim));

        // Employment verification now fails
        empResult = verifier.verify(userAlice, employSchema);
        assertFalse(empResult.valid);

        // KYC still valid
        kycResult = verifier.verify(userAlice, kycSchema);
        assertTrue(kycResult.valid);

        // Revoke KYC
        vm.prank(multisig);
        registry.revoke(kycClaim);

        // Both now invalid
        assertFalse(verifier.verify(userAlice, kycSchema).valid);
        assertFalse(verifier.verify(userAlice, employSchema).valid);
    }

    function test_e2e_batchIssuance() public {
        AttestationInput[] memory inputs = new AttestationInput[](2);
        inputs[0] = AttestationInput(userAlice, kycSchema, KYC_DATA, block.timestamp + 365 days);
        inputs[1] = AttestationInput(userBob, kycSchema, keccak256("bob_kyc"), block.timestamp + 365 days);

        vm.prank(issuerKYC);
        (bytes32[] memory ids, bool[] memory ok) = batcher.batchAttest(inputs);
        assertTrue(ok[0]);
        assertTrue(ok[1]);

        assertTrue(verifier.verify(userAlice, kycSchema).valid);
        assertTrue(verifier.verify(userBob, kycSchema).valid);
    }

    function test_e2e_delegatedIssuance() public {
        uint256 delegateKey = 0xDEAD;
        address delegateAddr = vm.addr(delegateKey);

        // KYC provider delegates to an agent
        vm.prank(issuerKYC);
        delegator.setDelegate(delegateAddr, kycSchema, block.timestamp + 30 days);

        // Agent issues KYC to Alice on behalf of KYC provider
        bytes32 message = keccak256(abi.encode(userAlice, kycSchema, KYC_DATA, block.timestamp + 365 days, block.chainid));
        bytes32 ethMessage = MessageHashUtils.toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(delegateKey, ethMessage);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(delegateAddr);
        bytes32 claimId = delegator.delegatedAttest(userAlice, kycSchema, KYC_DATA, block.timestamp + 365 days, issuerKYC, sig);
        assertTrue(registry.isValid(claimId));

        // Verify the claim is valid (issuer is the delegator contract since it calls registry.attest)
        VerificationResult memory result = verifier.verify(userAlice, kycSchema);
        assertTrue(result.valid);
    }
}

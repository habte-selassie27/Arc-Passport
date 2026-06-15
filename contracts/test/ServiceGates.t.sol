// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { AttestationRegistry } from "../src/core/AttestationRegistry.sol";
import { SchemaRegistry }    from "../src/core/SchemaRegistry.sol";
import { PassportVerifier }  from "../src/core/PassportVerifier.sol";
import { KycGate }           from "../src/services/verifiers/KycGate.sol";
import { DaoMembershipGate } from "../src/services/verifiers/DaoMembershipGate.sol";
import { ReputationGate }    from "../src/services/verifiers/ReputationGate.sol";
import { KYC_BASIC_ID }           from "../src/services/schemas/KycSchemas.sol";
import { DAO_MEMBERSHIP_ID }      from "../src/services/schemas/DaoSchemas.sol";
import { REPUTATION_SCORE_ID }    from "../src/services/schemas/ReputationSchemas.sol";

contract ServiceGatesTest is Test {
    AttestationRegistry public registry;
    SchemaRegistry      public schemaRegistry;
    PassportVerifier    public verifier;

    KycGate            public kycGate;
    DaoMembershipGate  public daoGate;
    ReputationGate     public repGate;

    address multisig = makeAddr("multisig");
    address issuer   = makeAddr("issuer");
    address subject  = makeAddr("subject");
    address subject2 = makeAddr("subject2");

    bytes32 constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
    bytes32 constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

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
        registry.grantRole(ISSUER_ROLE,  issuer);
        registry.grantRole(REVOKER_ROLE, multisig);
        // Register schemas at the EXACT IDs the gate constants reference.
        // The fieldsJson string MUST byte-for-byte match what
        // backend/src/constants/schemas.ts finalize() produces, since the
        // keccak256(encodePacked(name, version, fieldsJson)) is the canonical
        // schemaId derivation in both onchain SchemaRegistry and the backend.
        // See contracts/test/SchemaIdParity.t.sol for the full cross-check.
        string memory kycFields  = '[{"name":"level","type":"uint8"},{"name":"country","type":"string"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]';
        string memory daoFields  = '[{"name":"daoName","type":"string"},{"name":"daoAddress","type":"address"},{"name":"role","type":"string"},{"name":"joinedAt","type":"uint64"},{"name":"votingWeight","type":"uint256"}]';
        string memory repFields  = '[{"name":"score","type":"uint256"},{"name":"domain","type":"string"},{"name":"dataPoints","type":"uint32"},{"name":"updatedAt","type":"uint64"}]';
        require(KYC_BASIC_ID        == keccak256(abi.encodePacked("arcpass_kyc_basic",        "1.0.0", kycFields)), "KYC id drift");
        require(DAO_MEMBERSHIP_ID   == keccak256(abi.encodePacked("arcpass_dao_membership",   "1.0.0", daoFields)), "DAO id drift");
        require(REPUTATION_SCORE_ID == keccak256(abi.encodePacked("arcpass_reputation_score", "1.0.0", repFields)), "REP id drift");
        schemaRegistry.registerSchema("arcpass_kyc_basic",        "1.0.0", kycFields);
        schemaRegistry.registerSchema("arcpass_dao_membership",   "1.0.0", daoFields);
        schemaRegistry.registerSchema("arcpass_reputation_score", "1.0.0", repFields);
        vm.stopPrank();

        kycGate = new KycGate(address(verifier));
        daoGate = new DaoMembershipGate(address(verifier));
        repGate = new ReputationGate(address(verifier), 100);
    }

    // ─── KycGate ─────────────────────────────────────────────────────────────

    function test_KycGate_returnsTrue_whenValidClaim() public {
        vm.prank(issuer);
        registry.attest(subject, KYC_BASIC_ID, keccak256("kycData"), 0);

        assertTrue(kycGate.isKycVerified(subject, 1));
        assertTrue(kycGate.isKycVerified(subject, 2));
        assertTrue(kycGate.isKycVerified(subject, 3));
    }

    function test_KycGate_returnsFalse_whenNoClaim() public {
        assertFalse(kycGate.isKycVerified(subject, 1));
    }

    function test_KycGate_returnsFalse_whenRevoked() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, KYC_BASIC_ID, keccak256("kycData"), 0);
        vm.prank(multisig);
        registry.revoke(claimId);

        assertFalse(kycGate.isKycVerified(subject, 1));
    }

    function test_KycGate_returnsFalse_whenExpired() public {
        vm.prank(issuer);
        registry.attest(subject, KYC_BASIC_ID, keccak256("kycData"), block.timestamp + 1);
        vm.warp(block.timestamp + 2);

        assertFalse(kycGate.isKycVerified(subject, 1));
    }

    function test_KycGate_returnsFalse_forOtherSubject() public {
        vm.prank(issuer);
        registry.attest(subject, KYC_BASIC_ID, keccak256("kycData"), 0);

        assertFalse(kycGate.isKycVerified(subject2, 1));
    }

    function test_KycGate_modifier_revertsForUnverified() public {
        vm.expectRevert(bytes("KycGate: not KYC verified at required level"));
        kycGate.requireKycVerified(subject, 1);
    }

    function test_KycGate_modifier_passesForVerified() public {
        vm.prank(issuer);
        registry.attest(subject, KYC_BASIC_ID, keccak256("kycData"), 0);

        kycGate.requireKycVerified(subject, 1);
    }

    // ─── DaoMembershipGate ──────────────────────────────────────────────────

    function test_DaoGate_returnsTrue_whenMember() public {
        vm.prank(issuer);
        registry.attest(subject, DAO_MEMBERSHIP_ID, keccak256("daoData"), 0);

        assertTrue(daoGate.isMember(subject));
    }

    function test_DaoGate_returnsFalse_whenNotMember() public {
        assertFalse(daoGate.isMember(subject));
    }

    function test_DaoGate_returnsFalse_afterRevoke() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, DAO_MEMBERSHIP_ID, keccak256("daoData"), 0);
        vm.prank(multisig);
        registry.revoke(claimId);

        assertFalse(daoGate.isMember(subject));
    }

    // ─── ReputationGate ─────────────────────────────────────────────────────

    function test_RepGate_returnsTrue_whenClaimExists() public {
        vm.prank(issuer);
        registry.attest(subject, REPUTATION_SCORE_ID, keccak256("scoreData"), 0);

        assertTrue(repGate.isReputable(subject));
    }

    function test_RepGate_returnsFalse_whenNoClaim() public {
        assertFalse(repGate.isReputable(subject));
    }

    function test_RepGate_modifier_revertsForUnreputable() public {
        vm.expectRevert(bytes("ReputationGate: score below threshold"));
        repGate.requireReputable(subject);
    }

    function test_RepGate_modifier_passesForReputable() public {
        vm.prank(issuer);
        registry.attest(subject, REPUTATION_SCORE_ID, keccak256("scoreData"), 0);

        repGate.requireReputable(subject);
    }

    function test_RepGate_storesMinScore() public {
        assertEq(repGate.minScore(), 100);
    }

    // ─── Cross-gate independence ───────────────────────────────────────────

    function test_gatesAreIndependent() public {
        vm.prank(issuer);
        registry.attest(subject, KYC_BASIC_ID, keccak256("kyc"), 0);

        assertTrue(kycGate.isKycVerified(subject, 1));
        assertFalse(daoGate.isMember(subject));
        assertFalse(repGate.isReputable(subject));
    }

    function test_gatesAllReturnTrueForOmniCredentialedSubject() public {
        vm.startPrank(issuer);
        registry.attest(subject, KYC_BASIC_ID,        keccak256("kyc"), 0);
        registry.attest(subject, DAO_MEMBERSHIP_ID,   keccak256("dao"), 0);
        registry.attest(subject, REPUTATION_SCORE_ID, keccak256("rep"), 0);
        vm.stopPrank();

        assertTrue(kycGate.isKycVerified(subject, 1));
        assertTrue(daoGate.isMember(subject));
        assertTrue(repGate.isReputable(subject));
    }
}

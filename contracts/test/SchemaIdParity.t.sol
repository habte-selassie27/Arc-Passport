// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { SchemaRegistry }    from "../src/core/SchemaRegistry.sol";
import { AttestationRegistry } from "../src/core/AttestationRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { BASIC_IDENTITY_ID, LIVENESS_VERIFIED_ID }        from "../src/services/schemas/IdentitySchemas.sol";
import { CERTIFICATION_ID, LICENSE_ID, SKILL_ENDORSEMENT_ID } from "../src/services/schemas/CredentialSchemas.sol";
import { KYC_BASIC_ID, AML_SCREENING_ID, ACCREDITED_INVESTOR_ID, AGE_OVER_18_ID }
                                                        from "../src/services/schemas/KycSchemas.sol";
import { DAO_MEMBERSHIP_ID, GOVERNANCE_PARTICIPATION_ID, DELEGATE_ID }
                                                        from "../src/services/schemas/DaoSchemas.sol";
import { REPUTATION_SCORE_ID, POSITIVE_INTERACTION_ID, DISPUTE_RECORD_ID }
                                                        from "../src/services/schemas/ReputationSchemas.sol";
import { EMPLOYMENT_RECORD_ID, INCOME_BAND_ID, CONTRACTOR_RECORD_ID }
                                                        from "../src/services/schemas/EmploymentSchemas.sol";
import { DEGREE_ID, COURSE_COMPLETION_ID, BOOTCAMP_GRADUATE_ID }
                                                        from "../src/services/schemas/EducationSchemas.sol";
import { SOCIAL_ACCOUNT_ID, HUMANITY_PROOF_ID, FOLLOWER_MILESTONE_ID }
                                                        from "../src/services/schemas/SocialSchemas.sol";

/// @title SchemaIdParityTest
/// @notice CRITICAL: Verifies every onchain schemaId constant matches the value
///         that SchemaRegistry.registerSchema() would produce for the same
///         (name, version, fieldsJson) triple. This is the link between the
///         Solidity constants referenced by verifier gates and the registry's
///         onchain ID derivation. A mismatch means the gate will silently
///         fail to find any claim — a false negative at the verification layer.
///
///         The canonical encoder in backend/src/constants/schemas.ts (finalize())
///         builds fieldsJson by JSON.stringify-ing the array of {name, type} objects.
///         The strings here MUST be byte-for-byte identical to those JSON outputs.
contract SchemaIdParityTest is Test {
    SchemaRegistry      public schemaReg;
    AttestationRegistry public attReg;

    address multisig = makeAddr("multisig");

    function setUp() public {
        SchemaRegistry schemaImpl = new SchemaRegistry();
        ERC1967Proxy schemaProxy = new ERC1967Proxy(
            address(schemaImpl),
            abi.encodeCall(SchemaRegistry.initialize, (multisig))
        );
        schemaReg = SchemaRegistry(address(schemaProxy));

        AttestationRegistry attImpl = new AttestationRegistry();
        ERC1967Proxy attProxy = new ERC1967Proxy(
            address(attImpl),
            abi.encodeCall(AttestationRegistry.initialize, (multisig, address(schemaProxy)))
        );
        attReg = AttestationRegistry(address(attProxy));
    }

    /// @dev Helper — registers a schema on the live registry and returns the onchain id.
    function _registerAndReturnId(
        string memory name,
        string memory version,
        string memory fieldsJson
    ) internal returns (bytes32 onchainId) {
        onchainId = schemaReg.registerSchema(name, version, fieldsJson);
    }

    // ─── IDENTITY ────────────────────────────────────────────────────────────

    function test_parity_BASIC_IDENTITY() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_identity",
            "1.0.0",
            '[{"name":"displayName","type":"string"},{"name":"avatarCid","type":"string"},{"name":"createdAt","type":"uint64"}]'
        );
        assertEq(onchain, BASIC_IDENTITY_ID, "IdentitySchemas.BASIC_IDENTITY_ID must match onchain register");
    }

    function test_parity_LIVENESS_VERIFIED() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_liveness",
            "1.0.0",
            '[{"name":"verified","type":"bool"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
        );
        assertEq(onchain, LIVENESS_VERIFIED_ID, "IdentitySchemas.LIVENESS_VERIFIED_ID must match onchain register");
    }

    // ─── CREDENTIALS ─────────────────────────────────────────────────────────

    function test_parity_CERTIFICATION() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_certification",
            "1.0.0",
            '[{"name":"certName","type":"string"},{"name":"issuingBody","type":"string"},{"name":"certId","type":"string"},{"name":"issuedAt","type":"uint64"},{"name":"validUntil","type":"uint64"}]'
        );
        assertEq(onchain, CERTIFICATION_ID, "CredentialSchemas.CERTIFICATION_ID must match onchain register");
    }

    function test_parity_LICENSE() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_license",
            "1.0.0",
            '[{"name":"licenseType","type":"string"},{"name":"licenseNumber","type":"string"},{"name":"jurisdiction","type":"string"},{"name":"issuingBody","type":"string"},{"name":"validUntil","type":"uint64"}]'
        );
        assertEq(onchain, LICENSE_ID, "CredentialSchemas.LICENSE_ID must match onchain register");
    }

    function test_parity_SKILL_ENDORSEMENT() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_skill",
            "1.0.0",
            '[{"name":"skill","type":"string"},{"name":"level","type":"uint8"},{"name":"endorsedBy","type":"address"}]'
        );
        assertEq(onchain, SKILL_ENDORSEMENT_ID, "CredentialSchemas.SKILL_ENDORSEMENT_ID must match onchain register");
    }

    // ─── KYC ─────────────────────────────────────────────────────────────────

    function test_parity_KYC_BASIC() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_kyc_basic",
            "1.0.0",
            '[{"name":"level","type":"uint8"},{"name":"country","type":"string"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
        );
        assertEq(onchain, KYC_BASIC_ID, "KycSchemas.KYC_BASIC_ID must match onchain register");
    }

    function test_parity_AML_SCREENING() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_aml_screening",
            "1.0.0",
            '[{"name":"passed","type":"bool"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
        );
        assertEq(onchain, AML_SCREENING_ID, "KycSchemas.AML_SCREENING_ID must match onchain register");
    }

    function test_parity_ACCREDITED_INVESTOR() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_accredited_investor",
            "1.0.0",
            '[{"name":"jurisdiction","type":"string"},{"name":"validUntil","type":"uint64"},{"name":"provider","type":"string"}]'
        );
        assertEq(onchain, ACCREDITED_INVESTOR_ID, "KycSchemas.ACCREDITED_INVESTOR_ID must match onchain register");
    }

    function test_parity_AGE_OVER_18() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_age_over18",
            "1.0.0",
            '[{"name":"over18","type":"bool"},{"name":"checkedAt","type":"uint64"},{"name":"provider","type":"string"}]'
        );
        assertEq(onchain, AGE_OVER_18_ID, "KycSchemas.AGE_OVER_18_ID must match onchain register");
    }

    // ─── DAO ─────────────────────────────────────────────────────────────────

    function test_parity_DAO_MEMBERSHIP() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_dao_membership",
            "1.0.0",
            '[{"name":"daoName","type":"string"},{"name":"daoAddress","type":"address"},{"name":"role","type":"string"},{"name":"joinedAt","type":"uint64"},{"name":"votingWeight","type":"uint256"}]'
        );
        assertEq(onchain, DAO_MEMBERSHIP_ID, "DaoSchemas.DAO_MEMBERSHIP_ID must match onchain register");
    }

    function test_parity_GOVERNANCE_PARTICIPATION() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_governance_participation",
            "1.0.0",
            '[{"name":"daoAddress","type":"address"},{"name":"proposalsPassed","type":"uint32"},{"name":"votesParticipated","type":"uint32"},{"name":"delegatesCount","type":"uint32"},{"name":"updatedAt","type":"uint64"}]'
        );
        assertEq(onchain, GOVERNANCE_PARTICIPATION_ID, "DaoSchemas.GOVERNANCE_PARTICIPATION_ID must match onchain register");
    }

    function test_parity_DELEGATE() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_delegate",
            "1.0.0",
            '[{"name":"daoAddress","type":"address"},{"name":"delegatedFrom","type":"address[]"},{"name":"statement","type":"string"}]'
        );
        assertEq(onchain, DELEGATE_ID, "DaoSchemas.DELEGATE_ID must match onchain register");
    }

    // ─── REPUTATION ──────────────────────────────────────────────────────────

    function test_parity_REPUTATION_SCORE() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_reputation_score",
            "1.0.0",
            '[{"name":"score","type":"uint256"},{"name":"domain","type":"string"},{"name":"dataPoints","type":"uint32"},{"name":"updatedAt","type":"uint64"}]'
        );
        assertEq(onchain, REPUTATION_SCORE_ID, "ReputationSchemas.REPUTATION_SCORE_ID must match onchain register");
    }

    function test_parity_POSITIVE_INTERACTION() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_positive_interaction",
            "1.0.0",
            '[{"name":"context","type":"string"},{"name":"counterparty","type":"address"},{"name":"platform","type":"string"},{"name":"occurredAt","type":"uint64"}]'
        );
        assertEq(onchain, POSITIVE_INTERACTION_ID, "ReputationSchemas.POSITIVE_INTERACTION_ID must match onchain register");
    }

    function test_parity_DISPUTE_RECORD() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_dispute_record",
            "1.0.0",
            '[{"name":"type","type":"string"},{"name":"reportedBy","type":"address"},{"name":"evidence","type":"string"},{"name":"resolvedAt","type":"uint64"}]'
        );
        assertEq(onchain, DISPUTE_RECORD_ID, "ReputationSchemas.DISPUTE_RECORD_ID must match onchain register");
    }

    // ─── EMPLOYMENT ──────────────────────────────────────────────────────────

    function test_parity_EMPLOYMENT_RECORD() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_employment",
            "1.0.0",
            '[{"name":"employer","type":"string"},{"name":"role","type":"string"},{"name":"startDate","type":"uint64"},{"name":"endDate","type":"uint64"},{"name":"employerDid","type":"string"}]'
        );
        assertEq(onchain, EMPLOYMENT_RECORD_ID, "EmploymentSchemas.EMPLOYMENT_RECORD_ID must match onchain register");
    }

    function test_parity_INCOME_BAND() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_income_band",
            "1.0.0",
            '[{"name":"currency","type":"string"},{"name":"bandMin","type":"uint256"},{"name":"bandMax","type":"uint256"},{"name":"verifiedAt","type":"uint64"},{"name":"provider","type":"string"}]'
        );
        assertEq(onchain, INCOME_BAND_ID, "EmploymentSchemas.INCOME_BAND_ID must match onchain register");
    }

    function test_parity_CONTRACTOR_RECORD() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_contractor",
            "1.0.0",
            '[{"name":"platform","type":"string"},{"name":"completedJobs","type":"uint32"},{"name":"totalEarned","type":"uint256"},{"name":"rating","type":"uint16"},{"name":"updatedAt","type":"uint64"}]'
        );
        assertEq(onchain, CONTRACTOR_RECORD_ID, "EmploymentSchemas.CONTRACTOR_RECORD_ID must match onchain register");
    }

    // ─── EDUCATION ───────────────────────────────────────────────────────────

    function test_parity_DEGREE() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_degree",
            "1.0.0",
            '[{"name":"institution","type":"string"},{"name":"degree","type":"string"},{"name":"fieldOfStudy","type":"string"},{"name":"graduationYear","type":"uint16"},{"name":"institutionDid","type":"string"}]'
        );
        assertEq(onchain, DEGREE_ID, "EducationSchemas.DEGREE_ID must match onchain register");
    }

    function test_parity_COURSE_COMPLETION() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_course",
            "1.0.0",
            '[{"name":"courseName","type":"string"},{"name":"provider","type":"string"},{"name":"score","type":"uint8"},{"name":"completedAt","type":"uint64"},{"name":"certificateId","type":"string"}]'
        );
        assertEq(onchain, COURSE_COMPLETION_ID, "EducationSchemas.COURSE_COMPLETION_ID must match onchain register");
    }

    function test_parity_BOOTCAMP_GRADUATE() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_bootcamp",
            "1.0.0",
            '[{"name":"bootcamp","type":"string"},{"name":"track","type":"string"},{"name":"graduatedAt","type":"uint64"},{"name":"projectUri","type":"string"}]'
        );
        assertEq(onchain, BOOTCAMP_GRADUATE_ID, "EducationSchemas.BOOTCAMP_GRADUATE_ID must match onchain register");
    }

    // ─── SOCIAL ──────────────────────────────────────────────────────────────

    function test_parity_SOCIAL_ACCOUNT() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_social_account",
            "1.0.0",
            '[{"name":"platform","type":"string"},{"name":"handle","type":"string"},{"name":"profileId","type":"string"},{"name":"verifiedAt","type":"uint64"}]'
        );
        assertEq(onchain, SOCIAL_ACCOUNT_ID, "SocialSchemas.SOCIAL_ACCOUNT_ID must match onchain register");
    }

    function test_parity_HUMANITY_PROOF() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_humanity",
            "1.0.0",
            '[{"name":"verified","type":"bool"},{"name":"mechanism","type":"string"},{"name":"nullifier","type":"bytes32"},{"name":"checkedAt","type":"uint64"}]'
        );
        assertEq(onchain, HUMANITY_PROOF_ID, "SocialSchemas.HUMANITY_PROOF_ID must match onchain register");
    }

    function test_parity_FOLLOWER_MILESTONE() public {
        bytes32 onchain = _registerAndReturnId(
            "arcpass_follower_milestone",
            "1.0.0",
            '[{"name":"platform","type":"string"},{"name":"followerCount","type":"uint32"},{"name":"milestone","type":"uint32"},{"name":"verifiedAt","type":"uint64"}]'
        );
        assertEq(onchain, FOLLOWER_MILESTONE_ID, "SocialSchemas.FOLLOWER_MILESTONE_ID must match onchain register");
    }
}

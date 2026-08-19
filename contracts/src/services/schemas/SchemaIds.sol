// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Schema IDs MUST match the deterministic computation in SchemaRegistry.registerSchema():
//   keccak256(abi.encodePacked(name, version, fieldsJson))
// where fieldsJson is the JSON-stringified array of {name, type} field definitions
// (see backend/src/constants/schemas.ts finalize() for the canonical encoder).
//
// DO NOT change these constants unless the corresponding schema definition changes.
// Any mismatch between these and the values passed to registerSchema() will cause
// the verifier gates to silently return no valid claims (false negative).
//
// SchemaIdParity.t.sol asserts byte-for-byte equality with the onchain registry output.

// ─── Identity ──────────────────────────────────────────────────────────

bytes32 constant BASIC_IDENTITY_ID = keccak256(
    abi.encodePacked(
        "arcpass_identity",
        "1.0.0",
        '[{"name":"displayName","type":"string"},{"name":"avatarCid","type":"string"},{"name":"createdAt","type":"uint64"}]'
    )
);

bytes32 constant LIVENESS_VERIFIED_ID = keccak256(
    abi.encodePacked(
        "arcpass_liveness",
        "1.0.0",
        '[{"name":"verified","type":"bool"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
    )
);

// ─── KYC ───────────────────────────────────────────────────────────────

bytes32 constant KYC_BASIC_ID = keccak256(
    abi.encodePacked(
        "arcpass_kyc_basic",
        "1.0.0",
        '[{"name":"level","type":"uint8"},{"name":"country","type":"string"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
    )
);

bytes32 constant AML_SCREENING_ID = keccak256(
    abi.encodePacked(
        "arcpass_aml_screening",
        "1.0.0",
        '[{"name":"passed","type":"bool"},{"name":"provider","type":"string"},{"name":"checkedAt","type":"uint64"}]'
    )
);

bytes32 constant ACCREDITED_INVESTOR_ID = keccak256(
    abi.encodePacked(
        "arcpass_accredited_investor",
        "1.0.0",
        '[{"name":"jurisdiction","type":"string"},{"name":"validUntil","type":"uint64"},{"name":"provider","type":"string"}]'
    )
);

bytes32 constant AGE_OVER_18_ID = keccak256(
    abi.encodePacked(
        "arcpass_age_over18",
        "1.0.0",
        '[{"name":"over18","type":"bool"},{"name":"checkedAt","type":"uint64"},{"name":"provider","type":"string"}]'
    )
);

// ─── Credentials ───────────────────────────────────────────────────────

bytes32 constant CERTIFICATION_ID = keccak256(
    abi.encodePacked(
        "arcpass_certification",
        "1.0.0",
        '[{"name":"certName","type":"string"},{"name":"issuingBody","type":"string"},{"name":"certId","type":"string"},{"name":"issuedAt","type":"uint64"},{"name":"validUntil","type":"uint64"}]'
    )
);

bytes32 constant LICENSE_ID = keccak256(
    abi.encodePacked(
        "arcpass_license",
        "1.0.0",
        '[{"name":"licenseType","type":"string"},{"name":"licenseNumber","type":"string"},{"name":"jurisdiction","type":"string"},{"name":"issuingBody","type":"string"},{"name":"validUntil","type":"uint64"}]'
    )
);

bytes32 constant SKILL_ENDORSEMENT_ID = keccak256(
    abi.encodePacked(
        "arcpass_skill",
        "1.0.0",
        '[{"name":"skill","type":"string"},{"name":"level","type":"uint8"},{"name":"endorsedBy","type":"address"}]'
    )
);

// ─── DAO ───────────────────────────────────────────────────────────────

bytes32 constant DAO_MEMBERSHIP_ID = keccak256(
    abi.encodePacked(
        "arcpass_dao_membership",
        "1.0.0",
        '[{"name":"daoName","type":"string"},{"name":"daoAddress","type":"address"},{"name":"role","type":"string"},{"name":"joinedAt","type":"uint64"},{"name":"votingWeight","type":"uint256"}]'
    )
);

bytes32 constant GOVERNANCE_PARTICIPATION_ID = keccak256(
    abi.encodePacked(
        "arcpass_governance_participation",
        "1.0.0",
        '[{"name":"daoAddress","type":"address"},{"name":"proposalsPassed","type":"uint32"},{"name":"votesParticipated","type":"uint32"},{"name":"delegatesCount","type":"uint32"},{"name":"updatedAt","type":"uint64"}]'
    )
);

bytes32 constant DELEGATE_ID = keccak256(
    abi.encodePacked(
        "arcpass_delegate",
        "1.0.0",
        '[{"name":"daoAddress","type":"address"},{"name":"delegatedFrom","type":"address[]"},{"name":"statement","type":"string"}]'
    )
);

// ─── Reputation ────────────────────────────────────────────────────────

bytes32 constant REPUTATION_SCORE_ID = keccak256(
    abi.encodePacked(
        "arcpass_reputation_score",
        "1.0.0",
        '[{"name":"score","type":"uint256"},{"name":"domain","type":"string"},{"name":"dataPoints","type":"uint32"},{"name":"updatedAt","type":"uint64"}]'
    )
);

bytes32 constant POSITIVE_INTERACTION_ID = keccak256(
    abi.encodePacked(
        "arcpass_positive_interaction",
        "1.0.0",
        '[{"name":"context","type":"string"},{"name":"counterparty","type":"address"},{"name":"platform","type":"string"},{"name":"occurredAt","type":"uint64"}]'
    )
);

bytes32 constant DISPUTE_RECORD_ID = keccak256(
    abi.encodePacked(
        "arcpass_dispute_record",
        "1.0.0",
        '[{"name":"type","type":"string"},{"name":"reportedBy","type":"address"},{"name":"evidence","type":"string"},{"name":"resolvedAt","type":"uint64"}]'
    )
);

// ─── Employment ────────────────────────────────────────────────────────

bytes32 constant EMPLOYMENT_RECORD_ID = keccak256(
    abi.encodePacked(
        "arcpass_employment",
        "1.0.0",
        '[{"name":"employer","type":"string"},{"name":"role","type":"string"},{"name":"startDate","type":"uint64"},{"name":"endDate","type":"uint64"},{"name":"employerDid","type":"string"}]'
    )
);

bytes32 constant INCOME_BAND_ID = keccak256(
    abi.encodePacked(
        "arcpass_income_band",
        "1.0.0",
        '[{"name":"currency","type":"string"},{"name":"bandMin","type":"uint256"},{"name":"bandMax","type":"uint256"},{"name":"verifiedAt","type":"uint64"},{"name":"provider","type":"string"}]'
    )
);

bytes32 constant CONTRACTOR_RECORD_ID = keccak256(
    abi.encodePacked(
        "arcpass_contractor",
        "1.0.0",
        '[{"name":"platform","type":"string"},{"name":"completedJobs","type":"uint32"},{"name":"totalEarned","type":"uint256"},{"name":"rating","type":"uint16"},{"name":"updatedAt","type":"uint64"}]'
    )
);

// ─── Education ─────────────────────────────────────────────────────────

bytes32 constant DEGREE_ID = keccak256(
    abi.encodePacked(
        "arcpass_degree",
        "1.0.0",
        '[{"name":"institution","type":"string"},{"name":"degree","type":"string"},{"name":"fieldOfStudy","type":"string"},{"name":"graduationYear","type":"uint16"},{"name":"institutionDid","type":"string"}]'
    )
);

bytes32 constant COURSE_COMPLETION_ID = keccak256(
    abi.encodePacked(
        "arcpass_course",
        "1.0.0",
        '[{"name":"courseName","type":"string"},{"name":"provider","type":"string"},{"name":"score","type":"uint8"},{"name":"completedAt","type":"uint64"},{"name":"certificateId","type":"string"}]'
    )
);

bytes32 constant BOOTCAMP_GRADUATE_ID = keccak256(
    abi.encodePacked(
        "arcpass_bootcamp",
        "1.0.0",
        '[{"name":"bootcamp","type":"string"},{"name":"track","type":"string"},{"name":"graduatedAt","type":"uint64"},{"name":"projectUri","type":"string"}]'
    )
);

// ─── Social ────────────────────────────────────────────────────────────

bytes32 constant SOCIAL_ACCOUNT_ID = keccak256(
    abi.encodePacked(
        "arcpass_social_account",
        "1.0.0",
        '[{"name":"platform","type":"string"},{"name":"handle","type":"string"},{"name":"profileId","type":"string"},{"name":"verifiedAt","type":"uint64"}]'
    )
);

bytes32 constant HUMANITY_PROOF_ID = keccak256(
    abi.encodePacked(
        "arcpass_humanity",
        "1.0.0",
        '[{"name":"verified","type":"bool"},{"name":"mechanism","type":"string"},{"name":"nullifier","type":"bytes32"},{"name":"checkedAt","type":"uint64"}]'
    )
);

bytes32 constant FOLLOWER_MILESTONE_ID = keccak256(
    abi.encodePacked(
        "arcpass_follower_milestone",
        "1.0.0",
        '[{"name":"platform","type":"string"},{"name":"followerCount","type":"uint32"},{"name":"milestone","type":"uint32"},{"name":"verifiedAt","type":"uint64"}]'
    )
);

bytes32 constant WEB2_DATA_PROOF_ID = keccak256(
    abi.encodePacked(
        "arcpass_web2_data_proof",
        "1.0.0",
        '[{"name":"verified","type":"bool"},{"name":"provider","type":"string"},{"name":"templateId","type":"string"},{"name":"dataHash","type":"bytes32"},{"name":"checkedAt","type":"uint64"}]'
    )
);

bytes32 constant OPENID3_IDENTITY_ID = keccak256(
    abi.encodePacked(
        "arcpass_openid3_identity",
        "1.0.0",
        '[{"name":"linked","type":"bool"},{"name":"provider","type":"string"},{"name":"accountHandle","type":"string"},{"name":"accountVerified","type":"bool"},{"name":"linkedAt","type":"uint64"}]'
    )
);

// ─── ZK Passport ───────────────────────────────────────────────────────

bytes32 constant PASSPORT_AUTHENTICITY_ID = keccak256(
    abi.encodePacked(
        "arcpass_passport_authenticity",
        "1.0.0",
        '[{"name":"documentType","type":"string"},{"name":"issuerCountry","type":"string"},{"name":"issuingAuthority","type":"string"},{"name":"documentNumber","type":"string"},{"name":"issuedAt","type":"uint64"},{"name":"expiresAt","type":"uint64"},{"name":"verified","type":"bool"},{"name":"proofHash","type":"bytes32"}]'
    )
);

bytes32 constant ZK_ATTRIBUTE_PROOF_ID = keccak256(
    abi.encodePacked(
        "arcpass_zk_attribute_proof",
        "1.0.0",
        '[{"name":"attributeType","type":"string"},{"name":"attributeHash","type":"bytes32"},{"name":"circuitId","type":"string"},{"name":"verified","type":"bool"},{"name":"proofHash","type":"bytes32"},{"name":"verifiedAt","type":"uint64"}]'
    )
);

bytes32 constant NFC_PASSPORT_SCAN_ID = keccak256(
    abi.encodePacked(
        "arcpass_nfc_passport_scan",
        "1.0.0",
        '[{"name":"scanProvider","type":"string"},{"name":"documentType","type":"string"},{"name":"countryCode","type":"string"},{"name":"chipVerified","type":"bool"},{"name":"signatureValid","type":"bool"},{"name":"livenessPassed","type":"bool"},{"name":"scannedAt","type":"uint64"},{"name":"nullifier","type":"bytes32"}]'
    )
);

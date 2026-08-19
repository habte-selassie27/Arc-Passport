// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/AttestationRegistry.sol";
import "../src/core/SchemaRegistry.sol";
import "../src/core/PassportVerifier.sol";
import "../src/ScoreRegistry.sol";
import "../src/ScorerRegistry.sol";

contract PassportVerifierScoreTest is Test {
    AttestationRegistry public registry;
    SchemaRegistry public schemaRegistry;
    ScoreRegistry public scoreRegistry;
    ScorerRegistry public scorerRegistry;
    PassportVerifier public verifier;

    address multisig = makeAddr("multisig");
    address issuer   = makeAddr("issuer");
    address writer   = makeAddr("writer");
    address subject  = makeAddr("subject");
    address subject2 = makeAddr("subject2");

    bytes32 constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 constant REVOKER_ROLE = keccak256("REVOKER_ROLE");
    bytes32 constant SCORE_WRITER_ROLE = keccak256("SCORE_WRITER_ROLE");

    bytes32 schemaId;
    bytes32 schemaId2;
    bytes32 constant DATA = keccak256("data");

    function setUp() public {
        // Base registries
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

        // Score layer
        scorerRegistry = new ScorerRegistry();
        ScoreRegistry scoreImpl = new ScoreRegistry();
        ERC1967Proxy scoreProxy = new ERC1967Proxy(
            address(scoreImpl),
            abi.encodeCall(ScoreRegistry.initialize, (multisig, writer, 200))
        );
        scoreRegistry = ScoreRegistry(address(scoreProxy));

        // Verifier with score support
        verifier = new PassportVerifier(
            address(attProxy),
            address(scoreProxy),
            address(scorerRegistry)
        );

        // Setup roles
        vm.startPrank(multisig);
        registry.grantRole(ISSUER_ROLE, issuer);
        registry.grantRole(REVOKER_ROLE, multisig);
        scoreRegistry.grantRole(SCORE_WRITER_ROLE, writer);
        vm.stopPrank();

        // Register schemas
        vm.prank(multisig);
        schemaId = schemaRegistry.registerSchema("kyc_basic", "1.0", "fields");
        vm.prank(multisig);
        schemaId2 = schemaRegistry.registerSchema("residence", "1.0", "fields");
    }

    // ── getScore() ──
    function test_getScore_returnsScore() public {
        vm.prank(writer);
        scoreRegistry.commitScore(subject, 0, 650, uint64(block.timestamp + 86400), bytes32(0));

        (uint16 score, bool isValid, bool isHuman) = verifier.getScore(subject, 0);
        assertEq(score, 650);
        assertTrue(isValid);
        assertTrue(isHuman);
    }

    function test_getScore_revertsIfNoScoreSupport() public {
        // Deploy verifier without score support
        PassportVerifier noScoreVerifier = new PassportVerifier(address(registry), address(0), address(0));
        vm.expectRevert("Score support not configured");
        noScoreVerifier.getScore(subject, 0);
    }

    function test_getScore_expiredScore() public {
        vm.prank(writer);
        scoreRegistry.commitScore(subject, 0, 500, uint64(block.timestamp - 1), bytes32(0));

        (uint16 score, bool isValid, bool isHuman) = verifier.getScore(subject, 0);
        assertEq(score, 500);
        assertFalse(isValid);
        assertFalse(isHuman);
    }

    // ── passesScorer() — global scorer (scorerId=0) ──
    function test_passesScorer_global_aboveThreshold() public {
        vm.prank(writer);
        scoreRegistry.commitScore(subject, 0, 250, uint64(block.timestamp + 86400), bytes32(0));

        (bool passes, string memory reason) = verifier.passesScorer(subject, 0);
        assertTrue(passes);
        assertEq(reason, "");
    }

    function test_passesScorer_global_belowThreshold() public {
        vm.prank(writer);
        scoreRegistry.commitScore(subject, 0, 150, uint64(block.timestamp + 86400), bytes32(0));

        (bool passes, string memory reason) = verifier.passesScorer(subject, 0);
        assertFalse(passes);
        assertEq(reason, "Below humanity threshold");
    }

    function test_passesScorer_global_noScore() public {
        // No score committed for subject
        (bool passes, string memory reason) = verifier.passesScorer(subject, 0);
        assertFalse(passes);
    }

    // ── passesScorer() — custom scorer ──
    function test_passesScorer_custom_aboveThreshold_withRequiredSchemas() public {
        // Issue required attestation for subject
        vm.prank(issuer);
        registry.attest(subject, schemaId, DATA, 0);

        // Register custom scorer requiring schemaId
        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](1);
        weights[0] = ScorerRegistry.SchemaWeight(schemaId, 80);
        bytes32[] memory required = new bytes32[](1);
        required[0] = schemaId;

        vm.prank(multisig);
        uint16 scorerId = scorerRegistry.registerScorer("Custom", 200, weights, required);

        // Commit score
        vm.prank(writer);
        scoreRegistry.commitScore(subject, scorerId, 300, uint64(block.timestamp + 86400), bytes32(0));

        (bool passes, string memory reason) = verifier.passesScorer(subject, scorerId);
        assertTrue(passes);
        assertEq(reason, "");
    }

    function test_passesScorer_custom_missingRequiredSchema() public {
        // Register custom scorer requiring schemaId (not yet issued)
        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](0);
        bytes32[] memory required = new bytes32[](1);
        required[0] = schemaId;

        vm.prank(multisig);
        uint16 scorerId = scorerRegistry.registerScorer("Custom", 200, weights, required);

        // Commit score
        vm.prank(writer);
        scoreRegistry.commitScore(subject, scorerId, 300, uint64(block.timestamp + 86400), bytes32(0));

        (bool passes, string memory reason) = verifier.passesScorer(subject, scorerId);
        assertFalse(passes);
        // Reason contains "Missing required schema"
    }

    function test_passesScorer_custom_belowThreshold() public {
        // Issue required attestation
        vm.prank(issuer);
        registry.attest(subject, schemaId, DATA, 0);

        // Register custom scorer
        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](0);
        bytes32[] memory required = new bytes32[](1);
        required[0] = schemaId;

        vm.prank(multisig);
        uint16 scorerId = scorerRegistry.registerScorer("Custom", 500, weights, required); // threshold 500

        // Commit score below threshold
        vm.prank(writer);
        scoreRegistry.commitScore(subject, scorerId, 300, uint64(block.timestamp + 86400), bytes32(0));

        (bool passes, string memory reason) = verifier.passesScorer(subject, scorerId);
        assertFalse(passes);
        assertEq(reason, "Score below threshold");
    }

    function test_passesScorer_custom_inactive() public {
        ScorerRegistry.SchemaWeight[] memory weights = new ScorerRegistry.SchemaWeight[](0);
        bytes32[] memory required = new bytes32[](0);

        vm.prank(multisig);
        uint16 scorerId = scorerRegistry.registerScorer("Custom", 200, weights, required);

        // Deactivate
        vm.prank(multisig);
        scorerRegistry.deactivateScorer(scorerId);

        (bool passes, string memory reason) = verifier.passesScorer(subject, scorerId);
        assertFalse(passes);
        assertEq(reason, "Scorer is inactive");
    }

    function test_passesScorer_revertsIfNoScoreSupport() public {
        PassportVerifier noScoreVerifier = new PassportVerifier(address(registry), address(0), address(0));
        vm.expectRevert("Score support not configured");
        noScoreVerifier.passesScorer(subject, 0);
    }
}

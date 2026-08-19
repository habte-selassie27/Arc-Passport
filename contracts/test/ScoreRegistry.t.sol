// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ScoreRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ScoreRegistryTest is Test {
    ScoreRegistry public impl;
    ScoreRegistry public registry;

    address admin  = makeAddr("admin");
    address writer = makeAddr("writer");
    address user1  = makeAddr("user1");
    address user2  = makeAddr("user2");
    address rando  = makeAddr("rando");

    uint256 constant THRESHOLD = 200;

    function setUp() public {
        impl = new ScoreRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(ScoreRegistry.initialize, (admin, writer, THRESHOLD))
        );
        registry = ScoreRegistry(address(proxy));
    }

    function test_commitScore_succeeds() public {
        uint16 score_ = 650;
        uint64 expiresAt_ = uint64(block.timestamp + 86400);
        bytes32 commitment = keccak256(abi.encodePacked(user1, uint16(0), score_, uint64(block.timestamp)));

        vm.prank(writer);
        registry.commitScore(user1, 0, score_, expiresAt_, commitment);

        (uint16 score, bool isValid, bool isHuman_) = registry.getScore(user1, 0);
        assertEq(score, 650);
        assertTrue(isValid);
        assertTrue(isHuman_); // 650 >= 200
    }

    function test_commitScore_revertsIfNotWriter() public {
        vm.expectRevert();
        vm.prank(rando);
        registry.commitScore(user1, 0, 500, uint64(block.timestamp + 86400), bytes32(0));
    }

    function test_isScoreValid_falseWhenExpired() public {
        uint64 expiresAt_ = uint64(block.timestamp - 1); // already expired

        vm.prank(writer);
        registry.commitScore(user1, 0, 500, expiresAt_, bytes32(0));

        assertFalse(registry.isScoreValid(user1, 0));
    }

    function test_isHuman_belowThreshold() public {
        uint64 expiresAt_ = uint64(block.timestamp + 86400);

        vm.prank(writer);
        registry.commitScore(user1, 0, 150, expiresAt_, bytes32(0)); // 150 < 200

        (, bool isValid, bool isHuman_) = registry.getScore(user1, 0);
        assertTrue(isValid);
        assertFalse(isHuman_);
    }

    function test_isHuman_aboveThreshold() public {
        uint64 expiresAt_ = uint64(block.timestamp + 86400);

        vm.prank(writer);
        registry.commitScore(user1, 0, 250, expiresAt_, bytes32(0)); // 250 >= 200

        (, bool isValid, bool isHuman_) = registry.getScore(user1, 0);
        assertTrue(isValid);
        assertTrue(isHuman_);
    }

    function test_batchCommitScore() public {
        address[] memory subjects = new address[](3);
        uint16[] memory scorerIds = new uint16[](3);
        uint16[] memory scores_ = new uint16[](3);
        uint64[] memory expires = new uint64[](3);
        bytes32[] memory commitments = new bytes32[](3);

        subjects[0] = user1;
        subjects[1] = user2;
        subjects[2] = rando;
        scorerIds[0] = 0;
        scorerIds[1] = 0;
        scorerIds[2] = 1;
        scores_[0] = 300;
        scores_[1] = 150;
        scores_[2] = 800;
        expires[0] = uint64(block.timestamp + 86400);
        expires[1] = uint64(block.timestamp + 86400);
        expires[2] = uint64(block.timestamp + 86400);
        commitments[0] = bytes32(0);
        commitments[1] = bytes32(0);
        commitments[2] = bytes32(0);

        vm.prank(writer);
        registry.batchCommitScore(subjects, scorerIds, scores_, expires, commitments);

        (uint16 s0, , ) = registry.getScore(user1, 0);
        (uint16 s1, , ) = registry.getScore(user2, 0);
        (uint16 s2, , ) = registry.getScore(rando, 1);
        assertEq(s0, 300);
        assertEq(s1, 150);
        assertEq(s2, 800);
    }

    function test_setHumanityThreshold() public {
        vm.prank(admin);
        registry.setHumanityThreshold(300);

        assertEq(registry.humanityThreshold(), 300);

        // Score 250 now fails
        uint64 expiresAt_ = uint64(block.timestamp + 86400);
        vm.prank(writer);
        registry.commitScore(user1, 0, 250, expiresAt_, bytes32(0));

        (, , bool isHuman_) = registry.getScore(user1, 0);
        assertFalse(isHuman_); // 250 < 300
    }

    function test_commitScore_revertsOnZeroAddress() public {
        vm.expectRevert(ArcPass__ZeroAddress.selector);
        vm.prank(writer);
        registry.commitScore(address(0), 0, 500, uint64(block.timestamp + 86400), bytes32(0));
    }
}

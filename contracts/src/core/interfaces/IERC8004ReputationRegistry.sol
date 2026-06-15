// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC8004ReputationRegistry {
    function recordEvent(
        uint256 identityTokenId,
        string calldata eventType,
        string calldata metadataURI
    ) external returns (uint256 eventId);

    function getEvents(uint256 identityTokenId) external view returns (uint256[] memory eventIds);
}

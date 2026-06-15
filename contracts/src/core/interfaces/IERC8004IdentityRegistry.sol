// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC8004IdentityRegistry {
    function register(string calldata metadataURI) external returns (uint256 tokenId);
    function getIdentity(address owner) external view returns (uint256 tokenId, string memory metadataURI);
    function ownerOf(uint256 tokenId) external view returns (address);
}

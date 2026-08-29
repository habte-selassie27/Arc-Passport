/**
 * Arc IdentityRegistry predeploy — verified against the live contract.
 * Plain ERC-721: register() mints, tokenURI(tokenId) → profile metadata.
 * NOTE: there is no getIdentity() and no enumeration on the real contract.
 */
export const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "metadataURI", type: "string", internalType: "string" }],
    outputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
] as const;

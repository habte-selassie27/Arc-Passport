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
    name: "getIdentity",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [
      { name: "tokenId", type: "uint256", internalType: "uint256" },
      { name: "metadataURI", type: "string", internalType: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
] as const;

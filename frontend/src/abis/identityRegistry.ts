/**
 * Shared ABI for IdentityRegistry — single source of truth.
 * Used by RegisterPage, RegisterForm, and useIdentity.
 */
export const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getIdentity",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "metadataURI", type: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

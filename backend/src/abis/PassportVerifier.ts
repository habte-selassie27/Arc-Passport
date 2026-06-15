export const PASSPORT_VERIFIER_ABI = [
  {
    type: "function",
    name: "verify",
    inputs: [
      { name: "subject", type: "address", internalType: "address" },
      { name: "schemaId", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [
      { name: "valid", type: "bool", internalType: "bool" },
      { name: "claimId", type: "bytes32", internalType: "bytes32" },
      { name: "issuer", type: "address", internalType: "address" },
      { name: "issuedAt", type: "uint256", internalType: "uint256" },
      { name: "expiresAt", type: "uint256", internalType: "uint256" },
      { name: "dataCommitment", type: "bytes32", internalType: "bytes32" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifyMulti",
    inputs: [
      { name: "subject", type: "address", internalType: "address" },
      { name: "schemaIds", type: "bytes32[]", internalType: "bytes32[]" },
    ],
    outputs: [
      {
        components: [
          { name: "valid", type: "bool", internalType: "bool" },
          { name: "claimId", type: "bytes32", internalType: "bytes32" },
          { name: "issuer", type: "address", internalType: "address" },
          { name: "issuedAt", type: "uint256", internalType: "uint256" },
          { name: "expiresAt", type: "uint256", internalType: "uint256" },
          { name: "dataCommitment", type: "bytes32", internalType: "bytes32" },
        ],
        name: "results",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifyField",
    inputs: [
      { name: "claimId", type: "bytes32", internalType: "bytes32" },
      { name: "fieldLeaf", type: "bytes32", internalType: "bytes32" },
      { name: "proof", type: "bytes32[]", internalType: "bytes32[]" },
      { name: "leafIndex", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
] as const;

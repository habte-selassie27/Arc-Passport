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
        type: "tuple[]",
        components: [
          { name: "valid", type: "bool", internalType: "bool" },
          { name: "claimId", type: "bytes32", internalType: "bytes32" },
          { name: "issuer", type: "address", internalType: "address" },
          { name: "issuedAt", type: "uint256", internalType: "uint256" },
          { name: "expiresAt", type: "uint256", internalType: "uint256" },
          { name: "dataCommitment", type: "bytes32", internalType: "bytes32" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "error",
    name: "ArcPass__InvalidMerkleProof",
    inputs: [
      { name: "claimId", type: "bytes32", internalType: "bytes32" },
      { name: "fieldLeaf", type: "bytes32", internalType: "bytes32" },
    ],
  },
  {
    type: "error",
    name: "ArcPass__VerificationFailed",
    inputs: [
      { name: "subject", type: "address", internalType: "address" },
      { name: "schemaId", type: "bytes32", internalType: "bytes32" },
    ],
  },
  {
    type: "error",
    name: "ArcPass__ClaimAlreadyRevoked",
    inputs: [{ name: "claimId", type: "bytes32", internalType: "bytes32" }],
  },
  {
    type: "error",
    name: "ArcPass__ClaimExpired",
    inputs: [
      { name: "claimId", type: "bytes32", internalType: "bytes32" },
      { name: "expiredAt", type: "uint256", internalType: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ArcPass__InvalidSubject",
    inputs: [],
  },
  {
    type: "error",
    name: "ArcPass__ZeroAddress",
    inputs: [],
  },
] as const;

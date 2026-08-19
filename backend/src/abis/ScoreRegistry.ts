export const SCORE_REGISTRY_ABI = [
  {
    type: "function",
    name: "getScore",
    inputs: [
      { name: "subject", type: "address", internalType: "address" },
      { name: "scorerId", type: "uint16", internalType: "uint16" },
    ],
    outputs: [
      { name: "score", type: "uint16", internalType: "uint16" },
      { name: "isValid", type: "bool", internalType: "bool" },
      { name: "isHuman", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isHuman",
    inputs: [{ name: "subject", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isScoreValid",
    inputs: [
      { name: "subject", type: "address", internalType: "address" },
      { name: "scorerId", type: "uint16", internalType: "uint16" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "humanityThreshold",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "scores",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      { name: "", type: "uint16", internalType: "uint16" },
    ],
    outputs: [
      { name: "score", type: "uint16", internalType: "uint16" },
      { name: "dataCommitment", type: "bytes32", internalType: "bytes32" },
      { name: "computedAt", type: "uint64", internalType: "uint64" },
      { name: "expiresAt", type: "uint64", internalType: "uint64" },
      { name: "exists", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ScoreCommitted",
    inputs: [
      { name: "subject", type: "address", indexed: true },
      { name: "scorerId", type: "uint16", indexed: true },
      { name: "score", type: "uint16", indexed: false },
      { name: "computedAt", type: "uint64", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
    ],
  },
] as const;

export const SCORER_REGISTRY_ABI = [
  {
    type: "function",
    name: "scorers",
    inputs: [{ name: "", type: "uint16", internalType: "uint16" }],
    outputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "name", type: "string", internalType: "string" },
      { name: "threshold", type: "uint16", internalType: "uint16" },
      { name: "active", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getScorer",
    inputs: [{ name: "scorerId", type: "uint16", internalType: "uint16" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address", internalType: "address" },
          { name: "name", type: "string", internalType: "string" },
          { name: "threshold", type: "uint16", internalType: "uint16" },
          { name: "active", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getWeight",
    inputs: [
      { name: "scorerId", type: "uint16", internalType: "uint16" },
      { name: "schemaId", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRequireAll",
    inputs: [{ name: "scorerId", type: "uint16", internalType: "uint16" }],
    outputs: [{ name: "", type: "bytes32[]", internalType: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "scorerCount",
    inputs: [],
    outputs: [{ name: "", type: "uint16", internalType: "uint16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "canonicalRegistered",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ScorerRegistered",
    inputs: [
      { name: "scorerId", type: "uint16", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "threshold", type: "uint16", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ScorerDeactivated",
    inputs: [{ name: "scorerId", type: "uint16", indexed: true }],
  },
] as const;

export const SCORE_REGISTRY_ABI = [
  {
    type: "function",
    name: "getScore",
    inputs: [
      { name: "subject", type: "address" },
      { name: "scorerId", type: "uint16" },
    ],
    outputs: [
      { name: "score", type: "uint16" },
      { name: "isValid", type: "bool" },
      { name: "isHuman", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isHuman",
    inputs: [{ name: "subject", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "humanityThreshold",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "scores",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint16" },
    ],
    outputs: [
      { name: "score", type: "uint16" },
      { name: "dataCommitment", type: "bytes32" },
      { name: "computedAt", type: "uint64" },
      { name: "expiresAt", type: "uint64" },
      { name: "exists", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

export const SCORER_REGISTRY_ABI = [
  {
    type: "function",
    name: "scorers",
    inputs: [{ name: "", type: "uint16" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "name", type: "string" },
      { name: "threshold", type: "uint16" },
      { name: "active", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "scorerCount",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
    stateMutability: "view",
  },
] as const;

export const PASSPORT_VERIFIER_ABI = [
  {
    type: "function",
    name: "hasScoreSupport",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getScore",
    inputs: [
      { name: "subject", type: "address" },
      { name: "scorerId", type: "uint16" },
    ],
    outputs: [
      { name: "score", type: "uint16" },
      { name: "isValid", type: "bool" },
      { name: "isHuman", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

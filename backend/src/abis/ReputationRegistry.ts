export const REPUTATION_REGISTRY_ABI = [
  {
    type: "function",
    name: "recordEvent",
    inputs: [
      { name: "identityTokenId", type: "uint256", internalType: "uint256" },
      { name: "eventType", type: "string", internalType: "string" },
      { name: "metadataURI", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "eventId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEvents",
    inputs: [{ name: "identityTokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "eventIds", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
] as const;

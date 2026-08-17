export const BATCH_ATTESTATION_ABI = [
  {
    type: "function",
    name: "batchAttest",
    inputs: [
      {
        name: "inputs",
        type: "tuple[]",
        components: [
          { name: "subject", type: "address", internalType: "address" },
          { name: "schemaId", type: "bytes32", internalType: "bytes32" },
          { name: "dataCommitment", type: "bytes32", internalType: "bytes32" },
          { name: "expiresAt", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    outputs: [
      { name: "claimIds", type: "bytes32[]", internalType: "bytes32[]" },
      { name: "successes", type: "bool[]", internalType: "bool[]" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "BatchIssued",
    inputs: [
      { name: "count", type: "uint256", indexed: false },
      { name: "issuer", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

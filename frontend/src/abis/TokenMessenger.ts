export const TOKEN_MESSENGER_ABI = [
  {
    type: "function",
    name: "depositForBurn",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "destinationToken", type: "address" },
    ],
    outputs: [{ name: "nonce", type: "uint64" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "localMessageTransmitter",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

export const SCHEMA_REGISTRY_ABI = [
  {
    type: "function",
    name: "registerSchema",
    inputs: [
      { name: "name", type: "string", internalType: "string" },
      { name: "version", type: "string", internalType: "string" },
      { name: "fieldsJson", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "schemaId", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getSchema",
    inputs: [{ name: "schemaId", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      { name: "schemaId", type: "bytes32", internalType: "bytes32" },
      { name: "name", type: "string", internalType: "string" },
      { name: "version", type: "string", internalType: "string" },
      { name: "fieldsJson", type: "string", internalType: "string" },
      { name: "registrant", type: "address", internalType: "address" },
      { name: "registeredAt", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isRegistered",
    inputs: [{ name: "schemaId", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
] as const;

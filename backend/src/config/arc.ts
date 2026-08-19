import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const ADDRESSES = {
  identityRegistry:   (process.env.IDENTITY_REGISTRY_ADDRESS || "0x8004A818BFB912233c491871b3d84c89A494BD9e") as `0x${string}`,
  reputationRegistry: (process.env.REPUTATION_REGISTRY_ADDRESS || "0x8004B663056A597Dffe9eCcC1965A193B7388713") as `0x${string}`,
  attestationRegistry: process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}` | undefined,
  schemaRegistry:      process.env.SCHEMA_REGISTRY_ADDRESS as `0x${string}` | undefined,
  passportVerifier:    process.env.PASSPORT_VERIFIER_ADDRESS as `0x${string}` | undefined,
  batchAttestation:    process.env.BATCH_ATTESTATION_ADDRESS as `0x${string}` | undefined,
  scoreRegistry:       process.env.SCORE_REGISTRY_ADDRESS as `0x${string}` | undefined,
  scorerRegistry:      process.env.SCORER_REGISTRY_ADDRESS as `0x${string}` | undefined,
  zkVerifier:          process.env.ZK_VERIFIER_ADDRESS as `0x${string}` | undefined,
  zkPassportAdapter:   process.env.ZK_PASSPORT_ADAPTER_ADDRESS as `0x${string}` | undefined,
  humanityGate: process.env.HUMANITY_GATE_ADDRESS as `0x${string}` | undefined,
  web2DataGate: process.env.WEB2_DATA_GATE_ADDRESS as `0x${string}` | undefined,
  identityGate: process.env.IDENTITY_GATE_ADDRESS as `0x${string}` | undefined,
  usdcErc20:          "0x3600000000000000000000000000000000000000" as `0x${string}`,
  tokenMessengerV2:   "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
  msgTransmitterV2:   "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
  memoContract:       "0x9702466268ccF55eAB64cdf484d272Ac08d3b75b" as `0x${string}`,
} as const;

export const ALLOWED_BLOCKCHAIN = process.env.ARC_BLOCKCHAIN_ENV || "ARC-TESTNET";

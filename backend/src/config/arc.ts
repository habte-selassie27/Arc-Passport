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
  identityRegistry:   (process.env.VITE_IDENTITY_REGISTRY_ADDRESS || "0x8004A818BFB912233c491871b3d84c89A494BD9e") as `0x${string}`,
  reputationRegistry: (process.env.VITE_REPUTATION_REGISTRY_ADDRESS || "0x8004B663056A597Dffe9eCcC1965A193B7388713") as `0x${string}`,
  attestationRegistry: process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}` | undefined,
  schemaRegistry:      process.env.SCHEMA_REGISTRY_ADDRESS as `0x${string}` | undefined,
  passportVerifier:    process.env.PASSPORT_VERIFIER_ADDRESS as `0x${string}` | undefined,
  usdcErc20:          "0x3600000000000000000000000000000000000000" as `0x${string}`,
  tokenMessengerV2:   "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
  msgTransmitterV2:   "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
  memoContract:       "0x9702466268ccF55eAB64cdf484d272Ac08d3b75b" as `0x${string}`,
} as const;

export const ALLOWED_BLOCKCHAIN = process.env.ARC_BLOCKCHAIN_ENV || "ARC-TESTNET";

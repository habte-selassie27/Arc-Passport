const env = (key: string): string | undefined => {
  return (import.meta as Record<string, any>).env?.[key];
};

export const ADDRESSES = {
  identityRegistry:    (env("VITE_IDENTITY_REGISTRY_ADDRESS") ?? "0x8004A818BFB912233c491871b3d84c89A494BD9e") as `0x${string}`,
  reputationRegistry:  (env("VITE_REPUTATION_REGISTRY_ADDRESS") ?? "0x8004B663056A597Dffe9eCcC1965A193B7388713") as `0x${string}`,
  attestationRegistry:  env("VITE_ATTESTATION_REGISTRY_ADDRESS") as `0x${string}` | undefined,
  schemaRegistry:       env("VITE_SCHEMA_REGISTRY_ADDRESS") as `0x${string}` | undefined,
  passportVerifier:     env("VITE_PASSPORT_VERIFIER_ADDRESS") as `0x${string}` | undefined,
  usdcErc20:           "0x3600000000000000000000000000000000000000" as `0x${string}`,
  tokenMessengerV2:    "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
  msgTransmitterV2:    "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
  memoContract:        "0x9702466268ccF55eAB64cdf484d272Ac08d3b75b" as `0x${string}`,
} as const;

import { encodeAbiParameters, decodeAbiParameters, parseAbiParameters } from "viem";

export function encodeClaimData(types: string[], values: unknown[]): `0x${string}` {
  return encodeAbiParameters(parseAbiParameters(types.join(", ")), values);
}

export function decodeClaimData(
  types: string[],
  data: `0x${string}`
): readonly unknown[] {
  return decodeAbiParameters(parseAbiParameters(types.join(", ")), data);
}

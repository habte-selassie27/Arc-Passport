import { keccak256, encodePacked } from "viem";

export function computeSchemaId(
  name: string,
  version: string,
  fieldsJson: string
): `0x${string}` {
  return keccak256(encodePacked(["string", "string", "string"], [name, version, fieldsJson]));
}

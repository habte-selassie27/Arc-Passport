/**
 * Type-safe cast for values that have been regex-validated as 0x + 40 hex chars.
 * viem's `0x${string}` template literal type cannot be inferred from zod's
 * `.regex()` outputs, so this is the boundary at which we re-assert branding.
 */
export function asAddress(v: string): `0x${string}` {
  return v as `0x${string}`;
}

export function asSchemaId(v: string): `0x${string}` {
  return v as `0x${string}`;
}

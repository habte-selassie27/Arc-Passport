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

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Returns true if the value is a valid 20-byte hex address. */
export function isValidAddress(v: string): v is `0x${string}` {
  return ETH_ADDRESS_RE.test(v);
}

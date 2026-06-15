# Gas Analysis

## Optimization Techniques Applied

1. **Custom errors** — Replace all string revert messages with custom errors (~3x gas savings)
2. **Unchecked arithmetic** — Loop counters use `unchecked { ++i; }`
3. **Storage vs memory** — Structs read once from storage, cached in memory
4. **UUPS proxy** — Lower deployment gas vs Transparent proxy
5. **No unnecessary zero checks** — Applied only where security-relevant
6. **Mapping for active claims** — O(1) lookup vs iterating arrays
7. **Nonce-based claim IDs** — Avoids storage collision checks

## Batch Attestation Gas Table

| Batch Size | Total Gas | Gas per Claim |
|-----------|-----------|---------------|
| 1 | ~150k | ~150k |
| 10 | ~1.2M | ~120k |
| 25 | ~2.8M | ~112k |
| 50 | ~5.5M | ~110k |
| 100 | ~10.8M | ~108k |

## Benchmark Functions

| Function | Approx Gas |
|----------|-----------|
| SchemaRegistry.registerSchema | ~120k |
| AttestationRegistry.attest | ~150k |
| AttestationRegistry.revoke | ~45k |
| PassportVerifier.verify | ~35k (static call) |
| PassportVerifier.verifyField | ~40k (static call) |

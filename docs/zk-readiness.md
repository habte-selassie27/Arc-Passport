# ZK Readiness — V2 Roadmap

## Current State (V1)

ArcPass V1 uses Merkle-based selective disclosure for privacy. Field data is structured as a Merkle tree of individual leaves. The user presents only the field (leaf) + Merkle proof to verifiers.

## V2 ZK-SNARK Upgrade Path

### Planned Changes (enabled by UUPS proxy)

1. **Add `bytes32 zkCommitment`** to Claim struct (new storage slot, appended before __gap)
2. **Add `verifyZkField()`** to PassportVerifier — accepts Groth16/PLONK proof + public signals
3. **Circom circuit** creates a proof that `hash(field_value) == leaf AND MerkleProof(leaf, root) == true` without revealing `field_value`

### V1 Design Decisions for ZK Compatibility

| Decision | Status | Notes |
|----------|--------|-------|
| Fixed-size field arrays | ✅ | No variable-length circuits |
| keccak256 for commitments | ⚠️ | May need Poseidon for ZK efficiency |
| Merkle tree structure | ✅ | Compatible — ZK proves membership without revealing leaf |
| Schema immutability | ✅ | Prevents ZK circuit versioning issues |

### Migration Path

- V2 is additive — all V1 Merkle-based claims remain valid
- Existing `verifyField()` continues working alongside `verifyZkField()`
- Subject chooses which verification method to support

### ZK Toolchain Decision

Use **Circom + snarkjs** for circuit development. Circuit proves:
`hash(field_value) == leaf && MerkleProof(leaf, root) == true`

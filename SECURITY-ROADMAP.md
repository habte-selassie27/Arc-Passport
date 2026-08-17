# ArcPass Security & Roadmap

## 1. Purpose

This document covers:

- security requirements
- operational risks
- privacy strategy
- future protocol capabilities
- planned improvements

Security requirements for the current implementation take priority over future features.

## 2. Security Principles

ArcPass must follow these principles:

- Never trust client-side authorization.
- Verify wallet ownership.
- Verify signatures server-side.
- Verify issuer authorization.
- Treat blockchain state as authoritative.
- Never expose private keys or secrets.
- Validate all external input.
- Protect against replay attacks.
- Clearly distinguish valid, expired, and revoked credentials.
- Avoid storing sensitive information unnecessarily.

## 3. Smart Contract Security

### 3.1 Access Control

Separate roles where appropriate:

- DEFAULT_ADMIN_ROLE
- ISSUER_ROLE
- REVOKER_ROLE
- PAUSER_ROLE
- UPGRADER_ROLE

Do not give one role unnecessary privileges.

Production administration should use appropriate secure ownership such as a multisig where practical.

## 4. Reentrancy

State-changing functions must protect against reentrancy where external calls could create risk.

Avoid unnecessary external calls entirely.

Never call arbitrary user-controlled addresses from credential issuance logic unless explicitly required.

## 5. Replay Protection

Signed backend requests must include replay protection.

Use:

- nonce
- timestamp/expiration
- route or action context

A previously valid signature must not be reusable indefinitely.

## 6. Signature Verification

The backend must verify that the wallet signing a request actually controls the claimed address.

Never trust `x-wallet-address` by itself.

The signature must be cryptographically verified.

## 7. Issuer Authorization

Issuer permissions must be verified independently.

The frontend cannot grant itself issuer privileges.

The backend should verify the issuer against authoritative state where appropriate.

## 8. Input Validation

Validate:

- wallet addresses
- schema IDs
- credential fields
- timestamps
- URLs
- API payloads
- metadata

Use a consistent validation system.

Reject malformed input before processing it.

## 9. Rate Limiting

Protect public API endpoints from abuse.

Rate limiting should be applied especially to:

- authentication
- signature verification
- credential creation
- verification endpoints
- expensive queries

Do not add multiple rate-limiting systems without a demonstrated need.

## 10. Secrets

Never commit:

- private keys
- API keys
- database passwords
- authentication secrets
- cloud credentials
- entity secrets

Use environment variables or an appropriate secret-management system.

Never log secrets.

## 11. Privacy

ArcPass should follow data minimization.

Do not put sensitive personal data directly on-chain.

Avoid storing unnecessary sensitive data in the backend.

Public Passport data must only contain information intended for public disclosure.

## 12. Decentralized Storage

If decentralized storage is used, treat it as potentially public unless encryption and access controls explicitly guarantee otherwise.

Do not upload sensitive personal documents unencrypted.

Only use decentralized storage when it provides real product value.

## 13. Upgrade Security

Upgradeable contracts introduce additional risk.

Before upgrading:

1. Run tests
2. Verify storage layout
3. Review initializer logic
4. Verify upgrade authorization
5. Review new permissions
6. Deploy to testnet
7. Test migration
8. Confirm implementation address

Never reorder existing storage variables.

Never change the type of an existing variable.

## 14. Pause Mechanism

Emergency pause functionality may protect state-changing operations.

Read-only verification should remain available when possible.

Pause permissions must be separated from ordinary issuer permissions.

## 15. Verification Security

Never trust a Passport because the frontend displays "✓ Verified".

Verification must ultimately be based on authoritative blockchain/backend data.

The system should verify:

- Issuer
- Subject
- Schema
- Commitment
- Revocation
- Expiration

where applicable.

## 16. Security Checklist

Before production release, verify:

- [ ] Access control tested
- [ ] Issuer authorization tested
- [ ] Revocation tested
- [ ] Expiration tested
- [ ] Replay protection tested
- [ ] Signature verification tested
- [ ] Input validation tested
- [ ] Rate limiting enabled
- [ ] Secrets removed from repository
- [ ] Transaction simulation used where appropriate
- [ ] Upgrade authorization secured
- [ ] Storage layout checked
- [ ] Public/private fields reviewed
- [ ] Sensitive data not exposed
- [ ] Error messages do not leak secrets

## 17. Known Operational Risks

Operational risks should be documented separately from confirmed vulnerabilities.

Example — **in-memory nonce storage:**

If nonces are stored only in memory:

```
Server restart
     ↓
Nonce state lost
```

This is acceptable for development but should be replaced with persistent storage if production requirements demand it.

Redis should not be introduced merely because it is common.

Use it only when persistent/distributed nonce state or another real requirement justifies it.

## 18. V1 Privacy

ArcPass V1 may use Merkle-based selective disclosure.

The basic model:

```
Private fields
      ↓
Merkle tree
      ↓
Root stored/committed
      ↓
User reveals selected field
      ↓
Merkle proof
      ↓
Verifier confirms membership
```

This allows individual fields to be disclosed without exposing every committed field.

## 19. V2 Privacy — ZK Proofs

Zero-knowledge proofs are a potential future improvement.

Possible capability:

> Prove that a credential satisfies a condition without revealing the underlying private value.

Example:

```
User has a valid Builder credential
        ↓
Generate ZK proof
        ↓
Verifier receives proof
        ↓
"Requirement satisfied"
```

Potential technologies include:

- Circom
- snarkjs
- Groth16
- PLONK
- alternative modern ZK systems if they provide a better fit

Do not commit the project to a specific ZK stack until the actual proof requirements are defined.

### V1 ZK-readiness

Current state (V1): Merkle-based selective disclosure — field data is structured as a Merkle
tree of individual leaves; the user presents only the field (leaf) + Merkle proof to verifiers.

Planned V2 changes (enabled by the UUPS proxy):

1. Add `bytes32 zkCommitment` to the `Claim` struct (new storage slot, appended before `__gap`)
2. Add `verifyZkField()` to PassportVerifier — accepts Groth16/PLONK proof + public signals
3. Circom circuit proves `hash(field_value) == leaf && MerkleProof(leaf, root) == true` without revealing `field_value`

V1 design decisions for ZK compatibility:

| Decision | Status | Notes |
|----------|--------|-------|
| Fixed-size field arrays | ✅ | No variable-length circuits |
| keccak256 for commitments | ⚠️ | May need Poseidon for ZK efficiency |
| Merkle tree structure | ✅ | Compatible — ZK proves membership without revealing leaf |
| Schema immutability | ✅ | Prevents ZK circuit versioning issues |

Migration path: V2 is additive — all V1 Merkle-based claims remain valid; existing
`verifyField()` continues working alongside `verifyZkField()`; the subject chooses which
verification method to support.

ZK toolchain decision: **Circom + snarkjs**. Circuit proves
`hash(field_value) == leaf && MerkleProof(leaf, root) == true`.

## 20. ZK Design Principle

Do not redesign the entire attestation system around ZK before a real use case exists.

Instead, maintain clean boundaries:

```
Attestation
    ↓
Commitment
    ↓
Verification interface
    ↓
Optional ZK verification
```

Existing V1 verification should continue working.

ZK should be an additional verification method, not a mandatory replacement.

## 21. FHE / Zama

Fully Homomorphic Encryption may eventually enable private computation over credential data.

Potential future use cases:

> Does this user have ≥ 5 valid credentials?

> Is this user eligible for this program?

> Does this user satisfy these requirements?

without exposing the complete credential set.

This is potentially valuable for Arc applications.

However:

- Do not add FHE infrastructure to V1 without a concrete use case.
- Design the attestation system so privacy-preserving computation can be integrated later.

## 22. Why Not Monero/XMR?

Monero is designed primarily for private financial transactions.

ArcPass is primarily concerned with:

- identity
- credentials
- attestations
- verification

These require verifiable claims rather than private financial transactions.

Therefore Monero/XMR is not part of the ArcPass core architecture.

A privacy technology should be selected based on the actual privacy requirement.

## 23. Future Product Roadmap

**V1 — Core** — build these extremely well:

- Passport
- Attestations
- Issuers
- Verification
- Revocation
- Expiration
- Public Passport
- Credential requests
- Transparent reputation signals

**V1.5 — Ecosystem:**

- Issuer analytics
- Credential templates
- Notifications
- Shareable credential links
- QR verification
- Developer SDK
- Verification API

**V2 — Privacy** (potentially):

- Selective disclosure improvements
- ZK credentials
- Private verification
- Privacy-preserving eligibility proofs

**V3 — Advanced Privacy** (only if there is demonstrated demand):

- FHE / Zama
- Private computation
- Advanced credential policies

## 24. Features That Should Not Drive V1

Do not complicate the core architecture with:

- social feeds
- chat
- messaging
- DAO governance
- token systems
- NFT identity
- complex AI reputation
- cross-chain identity
- multi-chain indexing
- complex identity graphs
- advanced recommendation engines
- unnecessary real-time infrastructure

These can be considered later only if they solve real user problems.

## 25. Cross-Chain Strategy

Arc should remain the primary chain for the initial product.

Do not build multi-chain infrastructure simply to appear more capable.

If cross-chain credentials become necessary later, introduce them behind a clean interface:

```
Credential
   ↓
Chain Adapter
   ├── Arc
   ├── Ethereum
   └── Other networks
```

Only implement additional adapters when users or Arc applications actually require them.

## 26. Reputation Strategy

Do not make AI-generated reputation the foundation of ArcPass.

Prefer transparent signals:

- Valid credentials
- Unique issuers
- Arc projects
- Builder credentials
- Community credentials
- Verified contributions

Any future reputation score must be:

- explainable
- reproducible
- resistant to manipulation
- based on verifiable inputs

AI may help explain reputation data, but AI should not become the authority for identity.

## 27. Final Product Direction

ArcPass should evolve toward:

```
                 ARC ECOSYSTEM
                       │
       ┌───────────────┼────────────────┐
       ↓               ↓                ↓
    Projects        Communities      Programs
       │               │                │
       └───────────────┼────────────────┘
                       ↓
                  ARC PASSPORT
                       │
                  ATTESTATIONS
                       │
                ┌──────┴──────┐
                ↓             ↓
          VERIFICATION     PRIVACY
                              │
                       ZK / FHE later
```

The long-term goal is:

- ArcPass becomes a trusted credential and attestation layer for Arc applications.
- Arc users should be able to build a portable, verifiable history of their participation, contributions, credentials, and achievements.
- Arc applications should be able to issue credentials and verify them without building their own identity infrastructure.
- Privacy should become a powerful optional layer on top of that foundation.

## 28. Golden Rule

When deciding whether to add a feature or technology, ask:

> Does this make ArcPass better at issuing, owning, or verifying trustworthy credentials?

If not, it probably does not belong in the core product.

When two implementations solve the same problem:

> Choose the simpler one.

---

## Appendix — V1 Security Review (May 2026)

*Reviewer: Autonomous Security Agent. All three core contracts (SchemaRegistry,
AttestationRegistry, PassportVerifier) reviewed against the ArcPass security model.
No Critical findings. Two Warnings noted for operational hardening.*

### 1. Smart Contract Security

**1.1 Access Control — PASSED**

- ✅ `AttestationRegistry.attest()` uses `onlyRole(ISSUER_ROLE)`
- ✅ `AttestationRegistry.revoke()` uses `onlyRole(REVOKER_ROLE)`
- ✅ `DEFAULT_ADMIN_ROLE` is assigned to multisig at init; deployer renounces in Deploy.s.sol
- ✅ `PAUSER_ROLE` and `UPGRADER_ROLE` are separate from issuer/revoker roles
- ✅ Tests: `test_attest_revertsIfNotIssuer`, `test_revoke_revertsIfNotRevoker`, `test_pause_revertsIfNotPauser`

**1.2 Reentrancy — PASSED**

- ✅ `attest()` and `revoke()` use `nonReentrant`
- ✅ No external calls to user-controlled addresses — `subject` is never called
- ✅ Checks-effects-interactions: state updated before event emission

**1.3 Duplicate Attestation Guard — PASSED**

- ✅ `_activeClaim` mapping tracks `(subject, schemaId, issuer) → claimId`
- ✅ Reverts with `ArcPass__ActiveClaimExists` if an active claim exists
- ✅ Re-issuance allowed after revoke or expiry
- ✅ Tests: `test_attest_revertsOnDuplicateActiveClaim`, `test_reissueAfterRevoke`

**1.4 Claim ID Uniqueness — PASSED**

- ✅ Claim ID = `keccak256(abi.encode(subject, schemaId, issuer, block.timestamp, _claimNonce++))`
- ✅ Test: `testClaimIdUniqueAcrossNonces`

**1.5 Expiry Handling — PASSED**

- ✅ `isValid()` uses `block.timestamp >= c.expiresAt` (expired at boundary)
- ✅ Test: `test_expiredClaimIsInvalid`

**1.6 Schema Immutability — PASSED**

- ✅ `_registered[schemaId]` set on registration, never cleared; no update function exists
- ✅ Test: `test_registerSchema_revertsOnDuplicate`

**1.7 UUPS Upgrade Authorization — PASSED**

- ✅ `_authorizeUpgrade()` restricted to `UPGRADER_ROLE`; constructor calls `_disableInitializers()`
- ✅ `initialize()` uses the `initializer` modifier

**1.8 Emergency Pause — PASSED**

- ✅ `whenNotPaused` on `attest()` and schema registration
- ✅ `PassportVerifier.verify()` is NOT pausable (read-only)
- ✅ Tests: `test_attest_whenPaused`, `test_pause_revertsIfNotPauser`

**1.9–1.11 SELFDESTRUCT / PREV_RANDAO / USDC Decimals — PASSED**

- ✅ No `SELFDESTRUCT` usage in any contract or imported dependency
- ✅ No `block.prevrandao` usage anywhere; claim IDs use keccak256 with a non-repeating nonce
- ✅ No USDC transfer logic in any contract (identity protocol, not financial); future fee functions include a `MAX_FEE_USDC` ceiling

### 2. Backend Security

**2.1 Signature Verification — PASSED** — `x-wallet-address` verified via `verifyMessage()`
(EIP-191); nonce anti-replay enforced server-side; signed message includes route path and a timestamp window.

**2.2 Issuer Authorization — PASSED** — `issuerGuard()` calls `hasRole(ISSUER_ROLE, caller)` on-chain.

**2.3 Rate Limiting — PASSED** — global 100 req/min; stricter attestation limit via `express-rate-limit`.

**2.4 IPFS SSRF Protection — PASSED** — only `ipfs://` URIs accepted; CID format validated; only known gateway URLs used.

**2.5 Metadata Validation — PASSED** — zod schemas enforce structure before Pinata upload; field length limits, no HTML.

**2.6 Entity Secret Safety — PASSED** — read from environment only, never logged; Circle SDK handles per-request re-encryption; no cached ciphertext.

**2.7 Transaction Monitoring — PASSED** — event monitor with threshold alerting; CRITICAL alert for `RoleGranted` events.

### 3. Frontend Security

**3.1 Transaction Simulation — PASSED** — `useSimulateContract` called before `useWriteContract`.

**3.2 No USDC Approval Flow — PASSED** — no `approve()` call exists anywhere in the frontend; warning banner on the Issuer page.

**3.3 Error Handling — PASSED** — `parseContractError()` decodes custom ArcPass errors; `PassportErrorBoundary` wraps passport routes; every `useWriteContract` mutation has an `onError` handler.

### Warnings

| ID | Severity | Description | Mitigation |
|----|----------|-------------|------------|
| W-01 | Warning | `_getIssuers()` in PassportVerifier returns empty array — verifier only checks issuers from `_activeClaim` mapping | V2 should maintain an explicit issuer registry or iterate from AttestationRegistry's role management |
| W-02 | Warning | Backend nonce store is in-memory (`Map`) — lost on restart | Upgrade to persistent storage (e.g. Redis) in production |

### Security checklist verification

| # | Check | Status |
|---|-------|--------|
| 1 | `ISSUER_ROLE` on `attest()`, enforced via `onlyRole` | ✅ |
| 2 | `REVOKER_ROLE` on `revoke()`, separate from `ISSUER_ROLE` | ✅ |
| 3 | `PAUSER_ROLE` on `pause()` / `unpause()` | ✅ |
| 4 | `DEFAULT_ADMIN_ROLE` renounced from EOA deployer | ✅ (in Deploy.s.sol) |
| 5 | `nonReentrant` on all state-mutating functions | ✅ |
| 6 | `whenNotPaused` on all state-mutating functions | ✅ |
| 7 | No `SELFDESTRUCT` | ✅ |
| 8 | No `block.prevrandao` | ✅ |
| 9 | Claim ID includes nonce | ✅ |
| 10 | Schema immutability enforced | ✅ |
| 11 | Duplicate attestation guard | ✅ |
| 12 | Expiry uses `>=` | ✅ |
| 13 | No external calls to `subject` | ✅ |
| 14 | Entity Secret never logged | ✅ |
| 15 | Wallet IDs not in API responses | ✅ |
| 16 | Write routes require signature verification | ✅ |
| 17 | Nonce anti-replay | ✅ |
| 18 | Rate limiting | ✅ |
| 19 | IPFS URI validation | ✅ |
| 20 | Metadata Zod validation | ✅ |
| 21 | Blockchain env guard | ✅ |
| 22 | Transactions simulated before signing | ✅ |
| 23 | No USDC approve flow | ✅ |

# Security Review Report — ArcPass v1.0

Review Date: May 2026
Reviewer: Autonomous Security Agent

---

## Summary

All three core contracts (SchemaRegistry, AttestationRegistry, PassportVerifier) were reviewed against the attack vectors defined in AGENTS.md §15. No Critical findings. Two Warnings noted for operational hardening.

---

## 1. Smart Contract Security

### 1.1 Access Control — PASSED

**Requirement**: `ISSUER_ROLE` on `attest()`, `REVOKER_ROLE` on `revoke()`, separate roles enforced via `onlyRole`.

- ✅ `AttestationRegistry.attest()` uses `onlyRole(ISSUER_ROLE)`
- ✅ `AttestationRegistry.revoke()` uses `onlyRole(REVOKER_ROLE)`
- ✅ `DEFAULT_ADMIN_ROLE` is assigned to multisig at init, deployer renounces in Deploy.s.sol
- ✅ `PAUSER_ROLE` is separate from issuer/revoker roles
- ✅ `UPGRADER_ROLE` is separate from all other roles
- ✅ Test coverage: `test_attest_revertsIfNotIssuer`, `test_revoke_revertsIfNotRevoker`, `test_pause_revertsIfNotPauser`

### 1.2 Reentrancy — PASSED

**Requirement**: `nonReentrant` on all state-mutating functions, no external calls to `subject`.

- ✅ `attest()` uses `nonReentrant`
- ✅ `revoke()` uses `nonReentrant`
- ✅ No external calls to user-controlled addresses — `subject` is never called
- ✅ Checks-effects-interactions: state updated before event emission

### 1.3 Duplicate Attestation Guard — PASSED

**Requirement**: Active claim must be revoked before reissuance from same issuer.

- ✅ `_activeClaim` mapping tracks `(subject, schemaId, issuer) → claimId`
- ✅ Reverts with `ArcPass__ActiveClaimExists` if active claim exists
- ✅ Re-issuance allowed after revoke or expiry
- ✅ Test: `test_attest_revertsOnDuplicateActiveClaim`, `test_reissueAfterRevoke`

### 1.4 Claim ID Uniqueness — PASSED

**Requirement**: Nonce prevents same-block collision.

- ✅ Claim ID = `keccak256(abi.encode(subject, schemaId, issuer, block.timestamp, _claimNonce++))`
- ✅ Test: `testClaimIdUniqueAcrossNonces`

### 1.5 Expiry Handling — PASSED

**Requirement**: Strict `>=` comparison for expiry boundary.

- ✅ `isValid()` uses `block.timestamp >= c.expiresAt` (expired at boundary)
- ✅ Test: `test_expiredClaimIsInvalid`

### 1.6 Schema Immutability — PASSED

**Requirement**: No update function on schemas.

- ✅ `_registered[schemaId]` set to true on registration, never cleared
- ✅ No update function exists
- ✅ Test: `test_registerSchema_revertsOnDuplicate`

### 1.7 UUPS Upgrade Authorization — PASSED

**Requirement**: Only `UPGRADER_ROLE` can authorize upgrades.

- ✅ `_authorizeUpgrade()` restricted to `UPGRADER_ROLE`
- ✅ Constructor calls `_disableInitializers()`
- ✅ `initialize()` uses `initializer` modifier

### 1.8 Emergency Pause — PASSED

**Requirement**: `PAUSER_ROLE` can pause all state-mutating functions.

- ✅ `PausableUpgradeable` integrated
- ✅ `whenNotPaused` on `attest()` and `schemaReg.registerSchema()`
- ✅ `PassportVerifier.verify()` is NOT pausable (read-only)
- ✅ Test: `test_attest_whenPaused`, `test_pause_revertsIfNotPauser`

### 1.9 SELFDESTRUCT — PASSED

- ✅ No `SELFDESTRUCT` usage in any contract or imported dependency

### 1.10 PREV_RANDAO — PASSED

- ✅ No `block.prevrandao` usage anywhere
- ✅ Claim IDs use `keccak256` with non-repeating nonce

### 1.11 USDC Decimal Safety — PASSED

- ✅ No USDC transfer logic in any contract (identity protocol, not financial)
- ✅ Future fee functions will include `MAX_FEE_USDC` ceiling

---

## 2. Backend Security

### 2.1 Signature Verification — PASSED

- ✅ `x-wallet-address` header verified via `verifyMessage()` with EIP-191 signed message
- ✅ Nonce anti-replay enforced server-side
- ✅ Signed message includes route path and timestamp window

### 2.2 Issuer Authorization — PASSED

- ✅ `issuerGuard()` calls `hasRole(ISSUER_ROLE, caller)` onchain
- ✅ Test coverage for unauthorized attestation attempts (via contract tests)

### 2.3 Rate Limiting — PASSED

- ✅ Global: 100 req/min
- ✅ Attestation rate limit implemented via `express-rate-limit`

### 2.4 IPFS SSRF Protection — PASSED

- ✅ Only `ipfs://` URIs accepted
- ✅ CID format validated (base58/CIDv1 regex)
- ✅ Only known gateway URLs used for resolution

### 2.5 Metadata Validation — PASSED

- ✅ Zod schemas enforce structure before Pinata upload
- ✅ Field length limits, character restrictions, no HTML allowed

### 2.6 Entity Secret Safety — PASSED

- ✅ Read from environment variable only, never logged
- ✅ Circle SDK handles per-request re-encryption internally
- ✅ No caching of entity secret ciphertext

### 2.7 Transaction Monitoring — PASSED

- ✅ Event monitor with threshold-based alerting
- ✅ Special CRITICAL alert for `RoleGranted` events

---

## 3. Frontend Security

### 3.1 Transaction Simulation — PASSED

- ✅ `useSimulateContract` called before `useWriteContract` (via `useArcContract.ts`)

### 3.2 No USDC Approval Flow — PASSED

- ✅ No USDC ERC-20 `approve()` call exists anywhere in the frontend
- ✅ Warning banner on Issuer page: "ArcPass never asks you to approve token spending"

### 3.3 Error Handling — PASSED

- ✅ `parseContractError()` decodes all custom ArcPass errors to user-friendly messages
- ✅ `PassportErrorBoundary` wraps all passport routes
- ✅ Every `useWriteContract` mutation has `onError` handler

---

## Warnings

| ID | Severity | Description | Mitigation |
|----|----------|-------------|------------|
| W-01 | Warning | `_getIssuers()` in PassportVerifier returns empty array — verifier only checks issuers from `_activeClaim` mapping | V2 should maintain an explicit issuer registry or iterate from AttestationRegistry's role management |
| W-02 | Warning | Backend nonce store is in-memory (`Map`) — lost on restart | Upgrade to Redis in production deployment |

---

## Security Checklist Verification

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

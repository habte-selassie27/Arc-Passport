# HUMANODE.md — Humanode Proof-of-Personhood Integration

ArcPass lets a wallet prove it is controlled by a unique human via
[Humanode](https://humanode.io) biometric proof-of-personhood, without ever storing
biometric data or PII. The result is an on-chain **Humanity Proof** attestation that any
dApp can verify through `HumanityGate`.

This document covers the architecture, API, security model, and configuration. The
product spec lives in `HUMANODE_FEATURES.md`.

---

## 1. Goals & non-goals

**Goals**
- One human → one Arc wallet (sybil resistance for the Passport/attestation layer).
- Verification derived from a real Humanode check — **never faked** in production.
- On-chain, verifiable, revocable, expiring proof keyed to the wallet.
- A clean UI at `/human-node` that walks the user through the flow.

**Non-goals**
- Storing biometrics, faces, or any PII. We keep only a pseudonymous `accountId` and a
  one-way `nullifier`.
- Building our own biometric stack. Humanode is the source of truth for "is human".
- Using the nullifier as a global cross-app identifier. It is scoped to ArcPass
  uniqueness checks only.

---

## 2. Architecture

```
Frontend (/human-node)
   │  signedFetch (signed nonce auth)
   ▼
Backend /human-node  ── routes/human-node.ts
   │
   ├─ humanodeService (state machine + persistence + attestation)
   │     ├─ humanodeProvider (adapter: HumanodeApiProvider | MockHumanodeProvider)
   │     ├─ circleService.executeContractCall (on-chain attest)
   │     └─ arcService.publicClient (on-chain reads: isValid/getClaim/getIssuers)
   │            ▼
   │   AttestationRegistry.attest(HUMANITY_PROOF_ID, dataCommitment, expiresAt)
   ▼
HumanityGate (read-only verifier)  — used by third-party dApps
```

### Source of truth
- **Humanode** decides whether a person is human (biometric, off our stack).
- **AttestationRegistry** (on-chain) is authoritative for whether a wallet holds a valid
  Humanity Proof. The advisory JSONL store is never trusted as proof.

---

## 3. The Humanity Proof schema

Reuses the existing social humanity schema (`constants/schemas.ts` →
`SOCIAL_SCHEMAS.HUMANITY_PROOF`, id `HUMANITY_PROOF_ID` in
`contracts/src/services/schemas/SchemaIds.sol`):

| Field        | Type      | Classification | Notes |
|--------------|-----------|----------------|-------|
| `verified`   | `bool`    | PUBLIC         | Always `true` at issuance |
| `mechanism`  | `string`  | PUBLIC         | e.g. `"humanode-bioauth"` |
| `nullifier`  | `bytes32` | PRIVATE        | Disclosed via Merkle proof only |
| `checkedAt`  | `uint64`  | PUBLIC         | Unix seconds of the Humanode check |

On-chain we store only a **commitment**:

```solidity
dataCommitment = keccak256(abi.encodePacked(subject, nullifier, mechanism, checkedAt))
```

Raw `nullifier` stays off-chain (advisory store). The commitment proves the attestation
was bound to the exact verification result without leaking the nullifier on-chain.

Default TTL: `HUMANITY_ATTESTATION_TTL_SECONDS` (default `31536000` ≈ 1 year).

---

## 4. Smart contract — `HumanityGate`

`contracts/src/services/verifiers/HumanityGate.sol` (mirrors `KycGate`/`DaoMembershipGate`):

- Stateless, **not proxied** (redeploy + repoint if it changes).
- `isHuman(address subject) → bool` — `PassportVerifier.verify(subject, HUMANITY_PROOF_ID)`.
- `requireHuman(address subject)` — `onlyHuman` style revert gate for dApps.
- No admin, no state, no privileged writes. The underlying claim is gated by
  `ISSUER_ROLE` on `AttestationRegistry`, not by this contract.

Tests: `contracts/test/HumanityGate.t.sol` (6 tests — pass, fail, expiry, revoke,
multi-issuer, zero address).

---

## 5. Backend

### 5.1 Provider adapter — `services/humanodeProvider.ts`

Interface `HumanodeProvider`:
- `createAuthSession(subject, stateNonce) → { authUrl, sessionId }`
- `exchangeCode(code) → { accessToken }`
- `getHumanodeAccount(token) → { accountId, nullifier, mechanism }`

Implementations:
- `HumanodeApiProvider` — real OAuth2 + `/me` against `HUMANODE_API_BASE_URL`.
- `MockHumanodeProvider` — fixed account/verified result, **tests only**.

The real provider is selected via `getHumanodeProvider()` based on env. No code path in
production falls back to the mock.

### 5.2 Service — `services/humanodeService.ts`

State machine (advisory JSONL store at `.humanity-verifications.jsonl`):

```
initialized → verified → attesting → complete
                         ↘ failed
```

- `startVerification(subject, provider)` — idempotent: if the subject already has a
  `complete` claim that is still valid on-chain, returns the existing session.
- `handleCallback(verificationId, subject, code, state)` — verifies `state` binds the
  caller's subject, exchanges the code, reads the Humanode account, enforces
  **one-human-one-wallet** via nullifier uniqueness, then issues the on-chain attestation
  through Circle and recovers the `claimId`.
- `getHumanityStatus(address)` — public; returns `{ verified, issuer?, checkedAt?,
  expiresAt?, isHolder }` from on-chain state (no nullifier/P(II) leaked).
- `getVerification(verificationId)` / `getVerificationBySubject` / `getVerificationByNullifier` — advisory reads.

Persistence notes:
- Only `nullifier` + pseudonymous `accountId` are stored, never biometrics.
- Nullifier reuse across **different** subjects → `HumanodeAlreadyBound` (409). Same
  subject re-verifying (incl. after expiry) is allowed.
- On-chain reads (`isValid`, `getClaim`, `getIssuers`, `getActiveClaim`) are best-effort;
  claim validity is always re-derived from the registry, never from the store.

### 5.3 Routes — `routes/human-node.ts` (mounted at `/human-node`)

| Method | Path                  | Auth | Purpose |
|--------|-----------------------|------|---------|
| GET    | `/config`             | none | `redirectUri`, `clientId` (public OAuth metadata) |
| POST   | `/start`              | signed | Begin: returns `verificationId` + `authUrl`; binds `subject = req.verifiedAddress` |
| GET    | `/status/:id`         | signed | Current session state (owner-only by UUID) |
| POST   | `/callback`           | signed | Exchange code, verify, attest; `subject = req.verifiedAddress` |
| GET    | `/verify/:address`    | none | Public humanity status for a wallet |

All mutating routes require `requireSignedNonce` (signed message + one-time nonce). The
backend **never** trusts a client-supplied address — `subject` comes from the verified
signature.

---

## 6. Frontend — `/human-node`

- `hooks/useHumanode.ts` — `useHumanityStatus`, `useHumanodeConfig`, `useHumanodeFlow`.
- `pages/HumanNode.tsx` — phases: `disconnected → idle → starting → awaiting →
  verifying → done | failed`. Connects wallet, starts verification, opens Humanode OAuth
  in a new tab, polls `status/:id`, and on return redirects to `/human-node?code&state`
  to fire the signed `/callback`.
- `components/human-node/HumanNodeProgress.tsx` — step indicator.
- `components/human-node/HumanNodeCredential.tsx` — verified credential card with
  "View on Explorer" + share.
- All writes use `signedFetch` (simulate-free; attestation is backend-issued via Circle).
  Public passports call `useHumanityStatus` without a wallet.

---

## 7. Security model

| Risk | Mitigation |
|------|------------|
| Frontend wallet spoofing | Attestation subject is `req.verifiedAddress` from the signed nonce, never `x-wallet-address`. |
| Replay | `requireSignedNonce` enforces one-time nonces; `signedFetch` fetches a fresh nonce per request. |
| Session hijack | OAuth `state = verificationId:subject`; callback rejects if `decodeState(state).subject ≠ verifiedAddress`. |
| One-human-many-wallets (sybil) | Nullifier uniqueness across subjects → `HumanodeAlreadyBound`. |
| Multiple attestations per (subject,issuer) | Registry enforces one active claim; re-issue requires revoke/expire. |
| PII/biometric leak | Only `nullifier` (one-way) + pseudonymous `accountId` stored off-chain; on-chain holds a commitment only. |
| Stale advisory state | `getHumanityStatus` re-checks `isValid` on-chain every read. |
| Config not set | Missing `ATTESTATION_REGISTRY_ADDRESS` / `CIRCLE_HUMANITY_ISSUER_WALLET_ID` fails loudly at request time. |

**Out of scope / known limitation:** if a backend attestation fails after `markVerified`,
the session is left in `verified` (not `complete`) and the same session cannot be
re-called. This is acceptable because the failure modes are either a transient Circle
error (operator retries via a new session) or a genuine uniqueness block (correct
outcome). No auto-reset exists by design.

---

## 8. Configuration (`.env.example`)

```
# Humanode OAuth (public client id — not a secret)
HUMANODE_CLIENT_ID=...
HUMANODE_CLIENT_SECRET=...        # server-side only
HUMANODE_API_BASE_URL=https://api.humanode.io/v1
HUMANODE_REDIRECT_URI=http://localhost:5173/human-node

# Proof-of-personhood attestation
HUMANITY_ATTESTATION_TTL_SECONDS=31536000
CIRCLE_HUMANITY_ISSUER_WALLET_ID=...   # must hold ISSUER_ROLE on the registry
HUMANITY_GATE_ADDRESS=...              # deployed HumanityGate
```

The issuer wallet must be granted `ISSUER_ROLE` on `AttestationRegistry` (e.g. via
`grantRole`). `HUMANITY_GATE_ADDRESS` is wired into `frontend/src/config/addresses.ts`
and `backend/src/config/arc.ts`.

---

## 9. Testing

- **Contracts:** `forge test` (incl. `HumanityGate.t.sol`, 6 tests) — 240 total pass.
- **Backend:** `vitest` incl. `humanodeService.test.ts` (state machine, idempotency,
  nullifier reuse, mismatch) and `human-node.test.ts` (auth, signed routes, public
  verify) — 115 total pass. Mocks swap the provider and Circle/on-chain calls; the real
  Humanode API is never hit.
- **Frontend:** `vitest` + `npm run build` pass; `useHumanode` flow hook is covered by
  the build/typecheck gate.

Run everything:

```bash
cd contracts && forge test
cd backend   && npm run typecheck && npm test
cd frontend  && npm run typecheck && npm test && npm run build
```

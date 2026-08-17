# AGENTS.md — ArcPass

ArcPass is a wallet-linked, verifiable identity and attestation product for the Arc
ecosystem. Users connect a wallet, build a public Passport, receive attestations from
issuers, and anyone can verify them.

```
Connect Wallet → Create/View Passport → Receive/Issue Attestations → View Verification Status → Share Public Passport → Anyone Can Verify
```

This file is a practical guide for coding agents — intentionally short. The guiding
principle: **choose the simplest correct implementation**. Do not build architecture for
hypothetical futures; if a rule is missing here it is usually deliberate.

---

## 1. Product Scope

### Core (V1)

| Area | Capabilities |
|------|--------------|
| **Passport** | connect wallet, create/view a passport, update basic profile metadata, view attestations, share |
| **Attestations** | issue, view, verify, revoke, detect expired/revoked claims |
| **Verification** | anyone opens a public passport at `/passport/:address`, inspects attestations, verifies on-chain state, opens explorer links |

### Optional — build lightweight or not at all

These may exist but must **never complicate the core attestation architecture**:

- **Reputation signals** — transparent counters (counts, unique issuers, valid/expired/revoked), never opaque AI scores.
- **Issuer analytics** — a small dashboard (issued/active/revoked/expired counts, top credentials). Not an analytics platform.
- **Notifications** — simple DB-backed notifications (new attestation, expiring credential). No notification infrastructure.
- **ZK / selective disclosure** — V2. Keep data structures ZK-friendly (fixed-size fields, hash commitments) but do not build ZK infrastructure now.
- **Decentralized storage** — only if attestations carry substantial evidence. Small metadata stays on-chain.

**Out of scope for V1 (do not build):** social feeds, messaging/chat, DAO governance,
tokens, NFT identity, recommendation engines, multi-chain indexing, complex identity
graphs, microservices, event buses, CQRS, service meshes.

The strongest product is an excellent **attestation + verification layer**: make ArcPass
the place where anyone building on Arc issues verifiable credentials, and any app verifies
them. **Roadmap:** V1 = core scope above + reputation signals + lightweight
notifications; V1.5 = issuer analytics, attestation requests, QR verification, templates;
V2 = ZK/selective disclosure + API/SDK; V3 (only if demand) = cross-chain.

---

## 2. Architecture

```
Frontend (React)
   ↓
Backend API (Express) → Database (indexed state)
   ↓
Arc smart contracts (source of truth)
```

For reads at scale: `Arc → Indexer → Database → Backend → Frontend`.

### Source of truth

```
Blockchain = source of truth for on-chain state
Database   = indexed/application state (advisory, never authoritative for validity)
Frontend   = presentation state
```

Never let "frontend says verified" mean "passport is verified". Verification served to
users must derive from on-chain state (directly or via a re-verified read model): the
backend re-checks `isValid()` on-chain before trusting cached claims.

### Rules

1. **Choose the simpler implementation.** 3 clear files beat 10 that "solve it properly".
2. **No premature abstraction.** Introduce an abstraction only when it removes real
   duplication, solves a current problem, makes code easier to understand, or has a
   clear second implementation. Never "because we might need it later".
3. **Before adding anything** (service, database, queue, cache, framework, dependency,
   microservice, indexer, AI system): *"What concrete problem in the current application
   requires this?"* If there is no strong answer, don't add it.
4. **Feature decision rule:** does the feature make ArcPass easier to use, easier to
   verify, more trustworthy, more useful to issuers, or more useful to holders? If none
   of these, it does not belong in the MVP.

---

## 3. Repository Layout

```
arcpass/
├── AGENTS.md
├── .env.example                  ← canonical list of backend env vars
├── contracts/                    ← Foundry project (Solidity)
│   ├── foundry.toml
│   ├── src/
│   │   ├── core/                 ← AttestationRegistry, SchemaRegistry, PassportVerifier, interfaces, errors
│   │   ├── extensions/           ← BatchAttestation, DelegatedAttestation, ExpiringClaims
│   │   ├── services/schemas/     ← on-chain schema ID constants per service
│   │   ├── services/verifiers/   ← KycGate, DaoMembershipGate, ReputationGate
│   │   └── mocks/
│   ├── test/                     ← Foundry tests incl. integration + gas benchmarks
│   └── script/                   ← Deploy.s.sol, seed scripts, Circle wallet setup
├── backend/                      ← Node.js / Express API (TypeScript, ESM)
│   └── src/
│       ├── index.ts              ← bootstrap + route registration
│       ├── config/               ← arc chain, circle SDK, retention policy
│       ├── routes/               ← identity, attestation, reputation, passport, schema, issuer, v1/*
│       ├── services/             ← arcService (viem), circleService, ipfsService, passportService,
│       │                           attestation services per category (extend BaseAttestationService)
│       ├── middleware/           ← auth (signed nonce), issuerGuard, errorHandler
│       ├── indexer/              ← claimIndexer (on-chain events → DB read model)
│       ├── monitoring/           ← event monitor / alerts
│       ├── openapi/  abis/  constants/  utils/  __tests__/
├── frontend/                     ← React 19 + Vite + wagmi
│   └── src/
│       ├── App.tsx               ← routes
│       ├── pages/                ← Home, Passport, Register, Issuer, Verify, Schema, Guide, services/*, studio/*
│       ├── components/           ← passport/, forms/, shared/, studio/
│       ├── hooks/  contexts/  config/  abis/  utils/
├── ARCHITECTURE.md                ← system architecture & design principles
├── ATTESTATIONS.md                ← attestation model, schemas, issuer workflow
├── SECURITY-ROADMAP.md            ← security, audit findings, privacy roadmap
└── README.md
```

---

## 4. Tech Stack

| Layer | Tools |
|-------|-------|
| Contracts | Solidity `^0.8.24`, Foundry, Prague EVM, OpenZeppelin 5 (upgradeable variants for proxied contracts) |
| Backend | Node `>=20` (ESM), Express 4, TypeScript strict, viem 2, Circle Developer-Controlled Wallets SDK, Pinata (IPFS), zod, vitest |
| Frontend | React 19, Vite 5, TypeScript strict, wagmi 2, viem 2, TanStack Query 5, react-router-dom 6, Tailwind 4, qrcode.react, vitest |
| Infra | Arc Testnet (chain id `5042002`), USDC gas, Pinata, ArcScan |

Use the project's existing stack. No `ethers.js` in the frontend — wagmi/viem only.
Do not add dependencies unless one of the five dependency questions (§14) has a clear yes.

---

## 5. Arc Network

```typescript
// Chain config — identical shape in frontend/src/config/wagmi.ts and backend/src/config/arc.ts
export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
} as const;
```

### Critical Arc rules

- **USDC has two interfaces sharing one balance:** native gas is **18 decimals**; the
  ERC-20 interface is **6 decimals**. Always use `parseUnits(amount, 6)` for ERC-20 USDC
  amounts, never `parseEther()`. Mixing the scales is a Critical error.
- **Finality is < 1 second** and irreversible. Use `waitForTransactionReceipt` once —
  never confirmation-count polling.
- **`block.prevrandao` is always `0`** — never use it (or `blockhash`) as randomness.
  **`SELFDESTRUCT` is blocked.** Use Chainlink VRF or commit-reveal if randomness is needed.
- **Blocks can share timestamps.** Claim IDs must include a monotonic nonce — never rely
  on timestamp alone for uniqueness.

### Immutable Arc-native addresses (integrate, never redeploy)

```text
IdentityRegistry    0x8004A818BFB912233c491871b3d84c89A494BD9e
ReputationRegistry  0x8004B663056A597Dffe9eCcC1965A193B7388713
USDC (ERC-20, 6 dec) 0x3600000000000000000000000000000000000000
TokenMessengerV2    0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
MsgTransmitterV2    0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275
Memo (compliance)   0x9702466268ccF55eAB64cdf484d272Ac08d3b75b
```

---

## 6. Smart Contracts

Contracts contain only state and logic that genuinely needs blockchain guarantees:
passport ownership, attestations, issuer authorization, revocation, expiration. Ordinary
application logic stays off-chain.

### Core contracts (`contracts/src/core/`)

**AttestationRegistry** — the credential store. UUPS upgradeable (ERC-1967 proxy): the
proxy address is permanent; implementations change on upgrade.

- Roles: `ISSUER_ROLE`, `REVOKER_ROLE`, `PAUSER_ROLE`, `UPGRADER_ROLE` (granted from
  `DEFAULT_ADMIN_ROLE`, held by a multisig — no EOA admin in production).
- Claims store a **`bytes32 dataCommitment`** (keccak256 / Merkle root of the payload),
  **not** raw claim bytes. Raw data lives off-chain (§7).
- One active claim per `(subject, schemaId, issuer)` — re-issuance requires revoking or
  expiring the previous one. `claimId` includes a monotonic nonce.
- `attest()` / `revoke()` are `onlyRole(...)`, `nonReentrant`, `whenNotPaused`; all
  reverts use custom errors from `core/errors/ArcPassErrors.sol` — no string `require`s.
- Key views: `getClaim`, `getActiveClaim`, `getIssuers`, `isValid`.

**SchemaRegistry** — immutable claim schema definitions.

- `schemaId = keccak256(abi.encodePacked(name, version, fieldsJson))` — computed
  identically on-chain and off-chain (`backend/src/utils/schemaHash.ts`).
- Schemas cannot be updated; change = register a new version.

**PassportVerifier** — stateless, read-only, **not proxied** (redeploy + repoint if it
changes). `verify(subject, schemaId)`, `verifyMulti`, `verifyField` (Merkle proof against
a claim's `dataCommitment`). Verification derives from `AttestationRegistry.isValid`.

### Extensions (`contracts/src/extensions/`)

- **BatchAttestation** — `batchAttest` up to 100 claims per tx with per-item try/catch.
- **DelegatedAttestation**, **ExpiringClaims** — composable helpers.

### Service schemas & gates (`contracts/src/services/`)

Nine attestation categories share the same registry: identity, kyc, credentials, dao,
reputation, employment, education, social, custom. Canonical schema definitions live in
`backend/src/constants/schemas.ts`; the same `fieldsJson` string must compute schema IDs
on-chain (`services/schemas/*.sol`) and off-chain — a parity test enforces this.
`KycGate` / `DaoMembershipGate` / `ReputationGate` are thin stateless gates for third-party
dApps.

### Upgrade discipline (UUPS)

- Never reorder or change existing state variables between versions. Only append new
  value-type state before `__gap`, shrinking `__gap` by the slots consumed (mappings and
  dynamic arrays take no gap slots).
- Diff `forge inspect <Contract> storage-layout` between old and new implementations
  before any upgrade — slot reordering is Critical.
- `_authorizeUpgrade` is restricted to `UPGRADER_ROLE`; the implementation constructor
  calls `_disableInitializers()`. Document each version's layout in `ARCHITECTURE.md`
  (§16 Upgradeability).

### Gas

`foundry.toml`: Prague EVM, optimizer on (200 runs; `high-call` at 1000 for the hot
verifier path), CI profile with fuzz/invariant runs. Run `forge snapshot` before/after
contract changes — a >5% regression on a benchmarked function blocks merge. Batch costs
and benchmark numbers are documented in `ARCHITECTURE.md` (§17 Gas).

---

## 7. Privacy & Data Handling

- **Never store sensitive personal data on-chain:** no government IDs, phone numbers,
  emails, physical addresses, private documents, biometrics, or other PII.
- On-chain claims hold only a **commitment** (keccak256 / Merkle root). Raw field values
  are stored off-chain (encrypted on IPFS) and disclosed selectively via Merkle proofs
  (`verifyField`).
- Classify every claim field as `PUBLIC` (appears in the public passport), `PRIVATE`
  (disclosed only via subject-signed request + Merkle proof), or `DERIVED` (computed,
  never stored). Document schemas in `ATTESTATIONS.md` (§8–§9).
- **GDPR erasure:** on subject request, delete the off-chain payload (unpin IPFS, remove
  keys). The on-chain commitment becomes an orphaned hash — the audit trail that a claim
  existed remains, but it is no longer verifiable. Keep erasure audit records.
- Never log wallet addresses alongside PII, or return another subject's raw claim data
  without a subject-signed disclosure request. Keep claim metadata small; put bulky
  evidence on IPFS only when needed.

---

## 8. Backend

Keep it simple: `Route → Validation → Business Logic → Database / Blockchain`. No
controller/DTO/mapper/service/repository stacks unless actually justified.

### Structure

- **Routes** (`src/routes/`): `identity`, `attestation`, `reputation`, `passport`,
  `schema`, `issuer`, and `v1/` (kyc, credentials, dao, identity, reputation, employment,
  education, social, custom, passport, bulk, analytics, settings, openapi). Registered in
  `src/index.ts`; write-heavy v1 routes share a rate limiter.
- **Middleware:** `auth` (`requireSignedNonce` — signed message + anti-replay nonce),
  `issuerGuard` (on-chain `hasRole(ISSUER_ROLE, caller)`), `errorHandler`.
- **Services** (`src/services/`): thin wrappers over viem clients (`arcService`), the
  Circle SDK (`circleService`), IPFS (`ipfsService`), and domain services (`passportService`,
  `identityService`, attestation services per category extending `BaseAttestationService`).
- **Indexer** (`src/indexer/claimIndexer.ts`): `watchContractEvent` on `ClaimIssued` →
  upsert into the local read model. The DB is **advisory**: spot-check `isValid()`
  on-chain before serving cached claims and rebuild on mismatch.

### Contract writes

- **All backend writes go through the Circle Developer-Controlled Wallets SDK** — never
  raw `walletClient.writeContract` in services (Foundry scripts are the exception). Poll
  Circle transactions for `COMPLETE` / `FAILED` (correct spellings); Arc finalizes in <1s.
- Assert `ARC_BLOCKCHAIN_ENV` matches the target chain before submitting (no testnet
  payloads replayed on mainnet). Use per-service issuer wallet IDs (see §17).

### Auth

Never trust the `x-wallet-address` header alone. Mutating endpoints require a signed
message (`x-signature` + `x-nonce`) proving the caller controls the address; the nonce is
one-time-use to prevent replay. The frontend signs with `useSignMessage`.

### Errors & responses

- Success: `{ success: true, data: <payload> }` · Failure: `{ success: false, error: { code, message } }`
- Throw `ArcPassError` instances from `src/utils/errors.ts` (typed codes, HTTP status,
  optional context). Preserve the technical cause for logs; send the user a clear message.

---

## 9. Frontend

Prioritize clarity and usability. Core screens: Home, Passport, Attestations, Issue,
Verify. Routes (from `src/App.tsx`): `/`, `/guide`, `/register`, `/schema`,
`/passport/:address`, `/issue`, `/verify`, `/bridge`, `/studio/*`, `/services/*`.

### Rules

- **Public passport:** `/passport/:address` renders for visitors without a connected
  wallet — inspect attestations, see verification status, open explorer links. Wallet
  connection is required only for state-changing actions.
- **Writes:** `useSimulateContract` → `useWriteContract` → `useWaitForTransactionReceipt`;
  simulate before requesting a signature, never blind-sign. Show distinct tx states
  (Preparing → Wallet confirmation → Submitted → Confirming → Confirmed / Failed) and
  never show success before on-chain confirmation. Offer "View on Explorer" after.
- **Errors:** use `parseContractError` (`src/utils/parseContractError.ts`) so users see
  actionable text, never raw revert hex. Every `try/catch` sets error state or toasts.
- **State:** prefer local/component state; global context only for genuinely global data
  (wallet); TanStack Query for fetched data.
- **Attestation lifecycle:** claims are clearly `VALID`, `EXPIRED`, or `REVOKED` — revoked
  and expired credentials must never look identical to valid ones.
- Every screen needs loading, error, and empty states; forms/buttons accessible; mobile
  responsive. There is no USDC `approve()` flow anywhere in the app — if one appears, it's
  a bug. The Passport renders transparent reputation signals (§11), not an opaque score.

---

## 10. API Design

Predictable REST, flat and consumer-driven. No endpoints without a real consumer.

```text
GET    /passport/:address
GET    /passport/:address/attestations
POST   /attestations
GET    /attestations/:id
POST   /attestations/:id/revoke
GET    /verify/:address
```

Request bodies are validated with zod at the route. Routes call services; they never
call contracts directly. Don't create excessively nested or granular endpoints.

---

## 11. Reputation

Reputation is **not** the foundation of the product: `Identity → Attestations → optional
reputation signals`. Never build an opaque score (e.g. "Reputation: 87/100") or an AI
scoring model. Prefer transparent, verifiable signals:

```text
Verified Attestations    18
Unique Issuers            6
Arc Builder Credentials   4
Valid    16   Expiring  1   Revoked  1
```

Reputation always derives from on-chain attestations the viewer can inspect.

---

## 12. Database, Caching, Queues, Realtime

- **Database:** one relational database (Postgres) for indexing/search/caching/application
  metadata. Keep the schema minimal — don't create a table per conceptual object if an
  existing model represents it cleanly.
- **Caching:** optional — add only for a real, measured performance problem with clear
  invalidation. The DB read model is a cache, never authoritative for claim validity.
- **Queues:** only for genuinely async work (large indexing jobs, retryable external
  integrations). Never queue ordinary CRUD.
- **Realtime:** no WebSockets. `request → transaction → poll/refresh` suffices for
  passport/attestation flows.

---

## 13. Security

Validate: wallet ownership, authorization, user input, signatures, transaction state,
issuer permissions, attestation status. Never trust frontend-provided addresses, roles,
verification results, or client-side reputation.

- **Contracts:** role-gated writes, `nonReentrant` + `whenNotPaused`, custom errors,
  duplicate-attestation guard, strict expiry (`block.timestamp >= expiresAt` = expired),
  no external calls into subject addresses, no `prevrandao`, no `SELFDESTRUCT`.
- **Backend:** signed-message auth with anti-replay nonces, rate limiting on write
  endpoints, ipfs://-only URIs with CID validation, zod validation before any IPFS pin,
  `assertBlockchain` guard on every tx submission, USDC always `parseUnits(amount, 6)`.
- **Secrets:** `CIRCLE_ENTITY_SECRET` and wallet IDs are never committed, logged, or
  returned in API responses; `.env` is gitignored (secrets manager in production); rotate
  the Entity Secret immediately on any suspected exposure.
- **Frontend:** simulate before signing, no approval flows, CSP on the host, pinned
  dependencies, `npm audit` clean.
- **Ops:** 2FA + branch protection, pre-commit secret scanning, event monitor alerting on
  `RoleGranted`/`Paused`/`Unpaused`, issuer-wallet gas alert; deploy scripts require
  explicit env confirmation before touching mainnet.

Full threat model, security checklist, and audit findings: `SECURITY-ROADMAP.md`.

---

## 14. Dependencies

Before adding a dependency: do we really need it? Can the existing stack solve this?
Does it significantly reduce complexity? Is it actively maintained? Does it create
unnecessary architectural coupling? If the answers are mostly no, don't add it.

---

## 15. Error Handling & Logging

- Users get **actionable** messages, never raw revert data; technical detail goes to logs.
- Logs include useful context: operation, wallet address where appropriate, transaction
  hash, request ID, error cause. Never log private keys, secrets, tokens, or PII.
- Backend errors originate from the `ArcPassError` taxonomy; contract reverts surface via
  custom error names decoded on the frontend.

---

## 16. Testing

Prioritize tests around business-critical behavior — a few meaningful tests beat hundreds
of low-value ones. Do not chase artificial 100% coverage.

Highest priority: passport creation · wallet ownership verification · attestation
issuance/verification/revocation/expiration · authorization (every role-gated function
has an unauthorized-caller revert test) · contract edge cases (zero address, duplicate
claims, already-revoked, expired) · critical API endpoints (auth, issuer guard, verify) ·
Arc specifics (USDC decimals, schema ID parity on-chain vs off-chain).

```bash
cd contracts && forge build && forge test      # Foundry + gas snapshot
cd backend   && npm run typecheck && npm test  # tsc --noEmit + Vitest
cd frontend  && npm run typecheck && npm test  # tsc --noEmit + Vitest
```

Naming: Solidity `test_<function>_<scenario>`; TypeScript `describe("<Function>")` /
`it("should <scenario>")`. In Foundry tests use `makeAddr`, `vm.prank`, `vm.warp` — never
hardcode real addresses.

---

## 17. Environment Variables

Never hardcode secrets or contract addresses in source. The canonical lists are
`.env.example` (backend) and `frontend/.env.example`; contract addresses are populated
from env after `Deploy.s.sol` runs (Arc-native registry addresses have code defaults).

Key groups: **Arc** — `ARC_RPC_URL`, `ARC_CHAIN_ID`, `ARC_BLOCKCHAIN_ENV`; **Circle** —
`CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_ISSUER_WALLET_ID`, plus per-service
`CIRCLE_<SERVICE>_ISSUER_WALLET_ID`; **Contracts** — `ATTESTATION_REGISTRY_ADDRESS`,
`SCHEMA_REGISTRY_ADDRESS`, `PASSPORT_VERIFIER_ADDRESS`, `BATCH_ATTESTATION_ADDRESS` (and
`VITE_*` mirrors for the frontend); **IPFS** — `PINATA_API_KEY`, `PINATA_SECRET_KEY`;
**App** — `PORT`, `JWT_SECRET`, `NODE_ENV`.

Missing required env values fail loudly at startup, not silently at call time.

---

## 18. Development Workflow

Understand the existing implementation → identify the smallest change that solves the
problem → implement it, matching existing conventions → test it → remove experimental
code → verify existing functionality still works. Do not refactor unrelated parts of the
codebase while implementing a feature.

### Definition of done

A feature is complete when it works end-to-end; important errors are handled; loading,
error, and empty states exist; authorization is correct; blockchain state is verified
correctly; the mobile UI works; existing functionality is not broken; unnecessary code is
removed; and another developer can understand the implementation.

---

## 19. Agent Behavior

**DO:** inspect existing code first · reuse existing components and utilities · keep
changes focused · prefer simple solutions · fix root causes · test critical paths ·
remove dead code · keep documentation concise · explain important architectural decisions.

**DON'T:** rewrite the application unnecessarily · introduce architecture for hypothetical
scale · add dependencies without need · create abstractions without a real use case ·
create microservices prematurely · duplicate existing functionality · over-engineer CRUD ·
add AI because it's fashionable · put ordinary logic on-chain · add cross-chain features
before Arc is excellent · optimize before measuring a real problem.

### Golden rule

Between two valid implementations, **choose the simpler one**. Between a feature that
looks impressive and a feature that makes passport verification genuinely useful, choose
the latter. The goal: simple, understandable, secure, verifiable, maintainable, fast to
build, easy to debug, easy to extend — while keeping ArcPass focused on
**Create → Attest → Verify → Share**.

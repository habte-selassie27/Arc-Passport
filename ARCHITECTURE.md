# ArcPass Architecture

## 1. Overview

ArcPass is a decentralized identity and attestation application built for the Arc ecosystem.

The core purpose is simple:

> Let Arc users collect verifiable credentials and let Arc applications issue and verify those credentials.

ArcPass is **not** intended to be a social network, token platform, generalized cross-chain identity system, or complex reputation protocol.

### Core product flow

```
Connect Wallet
      ↓
Create / View Passport
      ↓
Receive / Issue Attestations
      ↓
Verify Credentials
      ↓
Share Passport
```

The primary product primitives are:

- Passport
- Attestation
- Issuer
- Verification

Everything else should support these primitives.

## 2. Design Principles

### 2.1 Simplicity First

Prefer the simplest implementation that solves the current problem.

Do not introduce architecture for hypothetical future requirements.

Prefer:

```
Simple function
```

over:

```
Factory → Strategy → Adapter → Repository → Service
```

unless the abstraction solves a real problem.

### 2.2 Blockchain Only Where It Adds Value

Use the blockchain for information that benefits from:

- verifiability
- immutability
- issuer authenticity
- revocation
- expiration
- ownership
- trustless verification

Do not put ordinary application data on-chain unnecessarily.

### 2.3 Source of Truth

```
Blockchain
    ↓
On-chain identity and attestation state

Database
    ↓
Indexing, search, caching, and application metadata

Frontend
    ↓
Presentation and temporary UI state
```

The database must not override authoritative on-chain state.

## 3. System Architecture

The preferred architecture is intentionally simple.

```
┌──────────────────────┐
│      Frontend        │
│ React + wagmi + viem │
└──────────┬───────────┘
           │
           ├──────────────────┐
           │                  │
           ▼                  ▼
┌──────────────────┐   ┌───────────────┐
│    Backend API   │   │   Arc L1      │
│     Express      │   │ Smart         │
│                  │   │ Contracts     │
└────────┬─────────┘   └───────┬───────┘
         │                     │
         ▼                     │
┌──────────────────┐           │
│    Database      │◀──────────┘
│ Indexing/Search   │
└──────────────────┘
```

The backend should remain a single application unless real scale or operational requirements justify separation.

Do not introduce microservices by default.

## 4. Frontend

The frontend provides the user-facing ArcPass experience.

Recommended core screens:

- Home
- Passport
- Attestations
- Issue
- Verify
- Issuer Dashboard

The frontend should prioritize:

- clear UX
- mobile responsiveness
- wallet connection
- transaction states
- verification status
- loading states
- empty states
- useful errors

Avoid unnecessary global state.

Use local/component state where possible.

Use global state only for genuinely global information.

## 5. Backend

The backend exists to support application functionality that should not live entirely in the browser.

Use it for:

- API endpoints
- authentication/signature verification
- authorization
- database access
- indexing
- search
- caching when necessary
- application metadata
- issuer management
- notifications
- external integrations

Keep request flow simple:

```
Route
 ↓
Validation
 ↓
Business Logic
 ↓
Database / Blockchain
```

Do not create unnecessary controller/service/repository layers.

## 6. Smart Contracts

ArcPass uses a small number of focused contracts.

**SchemaRegistry** — responsible for immutable attestation schema definitions.

**AttestationRegistry** — responsible for:

- issuing attestations
- storing attestation commitments
- revoking attestations
- expiration
- issuer authorization

**PassportVerifier** — responsible for verification and read-only verification helpers.

The verifier should not duplicate unnecessary state.

## 7. Arc Network

ArcPass is designed primarily for Arc.

Current Arc Testnet:

- Chain ID: 5042002

Known Arc ecosystem contracts should be treated as external dependencies.

Do not redesign Arc infrastructure inside ArcPass.

Do not add cross-chain support unless a concrete product requirement exists.

## 8. Passport

A Passport represents a wallet-linked ArcPass identity.

Conceptually:

```
Passport
├── wallet
├── profile metadata
├── attestations
├── issuer relationships
└── verification status
```

A Passport should be publicly viewable where information is intended to be public.

Wallet connection should not be required merely to view a public Passport.

Wallet connection is required for state-changing actions.

## 9. Public Passport

A public Passport should provide a shareable URL.

Example:

```
/passport/0x123...
```

A visitor should be able to see:

```
ArcPass

0x123...

✓ Passport valid

Credentials

✓ Arc Builder
✓ Hackathon Participant
✓ Protocol Contributor

12 Attestations
7 Issuers

[View on Explorer]
```

Technical blockchain information should be available but should not dominate the primary UX.

## 10. Attestations

An attestation represents a verifiable claim issued by an authorized issuer about a subject.

Conceptually:

```
Issuer
   ↓
Attestation
   ↓
Subject
```

An attestation may contain:

- subject
- issuer
- schema
- commitment/data
- issue time
- expiration
- status
- identifier

The blockchain provides the authoritative state for important verification properties.

## 11. Issuers

Issuers are organizations, projects, communities, or authorized entities that issue credentials.

Issuer flow:

```
Connect Wallet
      ↓
Verify Issuer Authorization
      ↓
Select Credential
      ↓
Select Recipient
      ↓
Issue Attestation
```

The issuer experience should be one of the main priorities of ArcPass.

ArcPass should make it easy for Arc projects to issue credentials without requiring them to understand smart-contract internals.

## 12. Verification

Verification is a core product feature.

Anyone should be able to verify:

- Passport validity
- credential validity
- issuer
- expiration
- revocation
- relevant blockchain state

Prefer human-readable results:

```
✓ Passport valid

✓ Credential valid
✓ Issuer verified
✓ Not revoked
✓ Not expired
```

Provide explorer links for technical verification.

## 13. Database

Use one primary application database unless there is a demonstrated need for additional systems.

Use the database for:

- indexed blockchain data
- search
- user-facing queries
- application metadata
- notifications
- issuer metadata

Do not treat the database as the authoritative source for on-chain claims.

## 14. Indexing

An indexer may mirror relevant blockchain events into the database.

Preferred flow:

```
Arc
 ↓
Events
 ↓
Indexer
 ↓
Database
 ↓
API
 ↓
Frontend
```

The indexer improves querying and UX.

It must not replace blockchain verification when authoritative verification is required.

## 15. Storage

Only use decentralized storage when it solves a real requirement.

Potential use cases include:

- credential evidence
- large metadata
- public documents
- content referenced by attestations

Do not add decentralized storage merely because ArcPass is a Web3 application.

Sensitive information must not be stored publicly.

## 16. Upgradeability

Upgradeable contracts must preserve storage layout.

Rules:

- Never reorder existing state variables.
- Never change the type of existing state variables.
- Add new variables only in safe locations.
- Preserve upgrade gaps where used.
- Verify storage layout before upgrades.
- Mappings and dynamic arrays do not consume `__gap` slots — only value types do. Append new value-type state before `__gap` and shrink `__gap` by the slots consumed.

Do not upgrade contracts simply to introduce unnecessary features.

### V1 storage layout

**AttestationRegistry** (UUPS proxy, `_disableInitializers()` set):

| Slot Range | Variable | Type | Notes |
|---|---|---|---|
| 0-49 | AccessControlUpgradeable | inherited | OZ standard layout |
| 50 | `schemaRegistry` | `ISchemaRegistry` | Address (1 slot) |
| 51 | `_claimNonce` | `uint256` | Monotonic counter |
| 52 | `_issuerList.length` | `uint256` | Dynamic array length |
| 53+ | `_issuerList[0..N]` | `address[]` | Dynamic array elements |
| mapping | `_isIssuer` | `mapping(address => bool)` | No physical slot |
| mapping | `_claims` | `mapping(bytes32 => Claim)` | No physical slot |
| mapping | `_activeClaim` | `mapping(address => mapping(bytes32 => mapping(address => bytes32)))` | No physical slot |
| 54-99 | `__gap[46]` | `uint256[46]` | Reserved for future V2+ |

**V1 → V2 migration:** append after `__gap`, reduce gap count by slots added.

**SchemaRegistry:**

| Slot Range | Variable | Type | Notes |
|---|---|---|---|
| 0-49 | AccessControlUpgradeable | inherited | OZ standard layout |
| mapping | `_schemas` | `mapping(bytes32 => Schema)` | No physical slot |
| mapping | `_registered` | `mapping(bytes32 => bool)` | No physical slot |
| 50 | `_schemaList.length` | `uint256` | Dynamic array length |
| 51+ | `_schemaList[0..N]` | `bytes32[]` | Dynamic array elements |
| 52-99 | `__gap[48]` | `uint256[48]` | Reserved for future |

### Upgrade verification

Before any upgrade, run:

```bash
forge inspect AttestationRegistry storage-layout --json > v1-layout.json
# ... deploy new implementation ...
forge inspect AttestationRegistryV2 storage-layout --json > v2-layout.json
diff v1-layout.json v2-layout.json
```

Any slot reordering is a **Critical** block on the upgrade.

## 17. Gas

Optimize gas where it matters, but do not sacrifice readability for insignificant savings.

Useful optimizations include:

- custom errors
- appropriate storage/memory usage
- mappings for O(1) lookups
- unchecked loop increments where safe
- batching where useful

Do not optimize code based only on theoretical gas savings.

Measure before making complicated optimizations.

### Optimizations applied in V1

1. **Custom errors** — replace all string revert messages with custom errors (~3x gas savings)
2. **Unchecked arithmetic** — loop counters use `unchecked { ++i; }`
3. **Storage vs memory** — structs read once from storage, cached in memory
4. **UUPS proxy** — lower deployment gas vs Transparent proxy
5. **No unnecessary zero checks** — applied only where security-relevant
6. **Mapping for active claims** — O(1) lookup vs iterating arrays
7. **Nonce-based claim IDs** — avoids storage collision checks

### Batch attestation gas

| Batch Size | Total Gas | Gas per Claim |
|-----------|-----------|---------------|
| 1 | ~150k | ~150k |
| 10 | ~1.2M | ~120k |
| 25 | ~2.8M | ~112k |
| 50 | ~5.5M | ~110k |
| 100 | ~10.8M | ~108k |

### Benchmark functions

| Function | Approx Gas |
|----------|-----------|
| SchemaRegistry.registerSchema | ~120k |
| AttestationRegistry.attest | ~150k |
| AttestationRegistry.revoke | ~45k |
| PassportVerifier.verify | ~35k (static call) |
| PassportVerifier.verifyField | ~40k (static call) |

## 18. Architecture Anti-Patterns

Do not introduce the following without a demonstrated requirement:

- microservices
- event sourcing
- CQRS
- service mesh
- complex event buses
- multiple databases
- Redis without a real caching requirement
- WebSockets without a real-time requirement
- complex dependency injection
- excessive interfaces
- complex repository patterns
- multi-chain infrastructure
- AI-driven identity systems
- large identity graphs

The default should always be the simplest architecture that works.

## 19. Privacy Architecture

### Selective Disclosure (V2 — implemented)

Each claim's `dataCommitment` on-chain is the Merkle root of its field leaves.
The full payload (field values, leaves, tree structure) is stored on IPFS
and indexed locally in the claim payload store.

```
Issuance → Merkle Tree → IPFS payload + On-chain root
Disclosure → Subject generates Merkle proof → Shares with verifier
Verification → On-chain verifyField() → Boolean result
```

Backend endpoints:
- `GET /attestation/:claimId/fields` — field classifications (subject-only)
- `GET /attestation/:claimId/field/:fieldName/proof` — Merkle proof (subject-only)
- `GET /attestation/:claimId/field/:fieldName/verify` — on-chain verification (public)

### Future layers

```
ArcPass
   ↓
Attestation (V1)
   ↓
Verification (V1)
   ↓
Selective Disclosure (V2 — implemented)
   ↓
ZK Proofs (V3 — roadmap)
   ↓
FHE / Private Computation (V4 — aspirational)
```

## 20. Trust Scoring Architecture

### Weighted Trust Score Engine

ArcPass computes a composite trust score from on-chain attestations using
a weighted scoring model inspired by Human Passport's composable trust layer.

```
On-chain Attestations
        ↓
Category Weights (identity=1.0, kyc=1.0, credentials=0.8, ...)
        ↓
Credential Scores (base points × schema bonuses)
        ↓
Issuer Bonuses (unique issuers per category)
        ↓
Composite Score (0-100)
        ↓
Threshold Check → Pass/Fail
```

### Scoring Policies

| Policy | Threshold | Use Case |
|--------|-----------|----------|
| Default | 20 | General purpose verification |
| High Security | 40 | KYC-gated applications |
| Low Friction | 10 | Quick verification, airdrops |

### Developer Verification API

```
GET  /v1/verify/:address           — single address verification
POST /v1/verify/batch              — batch verification (up to 50)
```

Query parameters:
- `policy` — scoring preset (default | high-security | low-friction)
- `threshold` — custom threshold override (0-100)
- `breakdown` — include category breakdown in response

### Frontend Display

The Passport page shows:
- Composite score with progress bar
- Pass/fail status with threshold
- Per-category breakdown with claim counts and points
- Active categories visualization

### Architecture Principles

1. **Transparent**: Score computed from visible, on-chain attestations
2. **Configurable**: Applications set their own thresholds
3. **Additive**: More attestations = higher score
4. **Not opaque**: All weighting factors are visible and documented
5. **Backend-computed**: Score is advisory; verification always re-checks on-chain

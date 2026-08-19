# ArcPass × Human Passport Integration — Senior Engineer Master Prompt

## Context for the Agent

You are a senior full-stack Web3 engineer working on **ArcPass** — a wallet-linked verifiable
identity and attestation protocol built on the Arc blockchain (chain ID 5042002). ArcPass already
has a working foundation:

- **Smart contracts:** `AttestationRegistry` (UUPS proxy), `SchemaRegistry` (UUPS proxy),
  `PassportVerifier` (stateless), `BatchAttestation`, `DelegatedAttestation`,
  `ExpiringClaims`, and gate contracts (`KycGate`, `DaoMembershipGate`, `ReputationGate`).
  All written in Solidity with Foundry. Contracts are deployed on Arc Testnet.
- **Backend:** Node.js / Express / TypeScript on port 3001. Uses Circle Developer-Controlled
  Wallets SDK for all contract writes. Has a claim indexer (watchContractEvent + block
  catch-up), passport service, IPFS via Pinata, signed-message auth, and a rate-alert monitor.
  24 canonical schemas across 9 service verticals are defined in `constants/schemas.ts`.
- **Frontend:** React 19, Vite 5, wagmi 2, viem 2, TanStack Query 5. Routes: `/`, `/guide`,
  `/register`, `/schema`, `/verify`, `/issue`, `/passport/:address`, `/studio/*`.
  All contract reads go directly on-chain via `useReadContract`. Writes go simulate-before-sign.
- **9 service verticals:** Identity & Passport, KYC / Compliance, Professional Credentials,
  DAO & Governance, Reputation & Trust, Employment & HR, Education, Social Verification,
  Custom / Open.

You are now integrating a **Human Passport–inspired composable trust layer** into ArcPass.
This means adding:

1. A **weighted Humanity Score** computed from the subject's ArcPass attestations.
2. A **Passport Score API** that applications can call (like Human Passport's Scorer API v2).
3. **Custom Scorers** that let third-party dApps configure their own weight profiles and
   thresholds.
4. **Deduplication** — one credential per (subject, schemaId) triple contributes to score; no
   double-counting across re-issuances.
5. **On-chain score commitments** via a new `ScoreRegistry` contract and EAS-style attestation
   pattern.
6. **Passport Embed SDK** — a drop-in `<ArcPassVerify />` React component for partner dApps.
7. **Score-gated access** UI on the public passport page, plus a `/score` API endpoint.
8. Full **frontend integration** of the score across all relevant pages using the new
   `FRONTEND_DESIGN.md` aesthetic (Space Grotesk / Inter / JetBrains Mono, `#00E5A0` verified
   accent, verified-pulse glow, `.card--verified` only for on-chain confirmed states).

This is an **additive integration only**. Do not break or remove any existing functionality.
All existing contract interfaces, API routes, and UI routes must continue to work exactly as before.

---

## Part 1 — Smart Contracts

### 1.1 New Contract: `ScoreRegistry.sol`

Create `contracts/src/ScoreRegistry.sol`. This contract stores committed Humanity Scores
on-chain, following the same UUPS upgradeable proxy pattern as `AttestationRegistry`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ScoreRegistry
 * @notice Stores committed Humanity Scores for ArcPass subjects.
 *
 * Design decisions:
 * - The backend computes scores off-chain and commits a bytes32 scoreCommitment
 *   (keccak256(abi.encodePacked(subject, scorerId, score, computedAt))).
 * - Raw score is also stored as uint16 (0–1000, representing 0.0–100.0 with one
 *   decimal of precision: score 825 = 82.5).
 * - Scores are per (subject, scorerId) pair. scorerId = 0 is the canonical ArcPass
 *   global scorer. Non-zero scorerIds are custom scorers registered by dApps.
 * - Only SCORE_WRITER_ROLE can commit scores.
 * - Scores have an expiresAt timestamp. Expired scores must be refreshed.
 * - Emits ScoreCommitted(subject, scorerId, score, computedAt, expiresAt).
 */

// Implementation requirements:
// - UUPS upgradeable (OpenZeppelin UUPSUpgradeable + AccessControlUpgradeable).
// - Roles: SCORE_WRITER_ROLE, UPGRADER_ROLE.
// - Storage struct ScoreRecord { uint16 score; bytes32 commitment; uint64 computedAt;
//   uint64 expiresAt; bool exists; }.
// - Mapping: scores[subject][scorerId] => ScoreRecord.
// - commitScore(address subject, uint16 scorerId, uint16 score, uint64 expiresAt,
//   bytes32 commitment) external onlyRole(SCORE_WRITER_ROLE).
// - getScore(address subject, uint16 scorerId) external view returns (ScoreRecord memory).
// - isScoreValid(address subject, uint16 scorerId) external view returns (bool).
//   Returns false if not exists or block.timestamp >= expiresAt.
// - isHuman(address subject) external view returns (bool).
//   Returns isScoreValid(subject, 0) && scores[subject][0].score >= HUMANITY_THRESHOLD.
//   HUMANITY_THRESHOLD = 200 (= 20.0 in display units, matching Human Passport default).
//   This threshold is a storage variable, updatable by DEFAULT_ADMIN_ROLE.
// - batchCommitScore(CommitScoreParams[] calldata params) for efficiency.
// - NO raw PII stored. Score only. The commitment links back to the off-chain computation.
```

**Write the complete contract. Include NatDoc for every public function. Include a
`ScoreRegistryV1` initialize function. No constructor — UUPS pattern.**

### 1.2 New Contract: `ScorerRegistry.sol`

Create `contracts/src/ScorerRegistry.sol`. This is the on-chain registry for Custom Scorers.

```solidity
/**
 * @title ScorerRegistry
 * @notice Allows dApps to register custom scorer configurations on-chain.
 *
 * A Scorer is identified by a uint16 scorerId. scorerId 0 is reserved for the
 * canonical ArcPass global scorer (registered by admin at deploy time).
 *
 * Each Scorer stores:
 * - owner: address — the dApp that registered it.
 * - name: string — human-readable label (e.g. "MyDAO Governance Scorer").
 * - threshold: uint16 — the minimum score required to pass.
 * - schemaWeights: mapping(bytes32 schemaId => uint8 weight) — weight 0–100 per schema.
 *   Weight 0 means "this schema contributes nothing in this scorer."
 *   Weight 100 = maximum contribution (actual point value determined off-chain).
 * - requireAll: bytes32[] — schemas that MUST be present and valid regardless of score.
 * - active: bool.
 *
 * Functions:
 * - registerScorer(name, threshold, schemaWeights[], requireAll[])
 *   returns uint16 scorerId. Emits ScorerRegistered.
 * - updateScorer(scorerId, threshold, schemaWeights[], requireAll[])
 *   onlyOwner(scorerId). Emits ScorerUpdated.
 * - deactivateScorer(scorerId) onlyOwner. Emits ScorerDeactivated.
 * - getScorer(scorerId) returns (ScorerConfig memory).
 * - scorerCount() returns uint16.
 *
 * NOT upgradeable — intentionally immutable so dApps can trust their scorerId
 * configuration cannot be changed by ArcPass admins.
 */
```

**Write the complete contract. Keep it under 200 lines. Tight, no bloat.**

### 1.3 Extend `PassportVerifier.sol`

Add two new read functions to the existing `PassportVerifier` contract (do NOT change the
existing `verify`, `verifyMulti`, `verifyField` functions or their signatures):

```solidity
/**
 * @notice Returns the on-chain committed score for a subject under a given scorer.
 * @dev Delegates to ScoreRegistry. Returns (score, isValid, isHuman).
 * @param subject The wallet address.
 * @param scorerId 0 = global ArcPass scorer, non-zero = custom scorer.
 */
function getScore(address subject, uint16 scorerId)
    external view
    returns (uint16 score, bool isValid, bool isHuman);

/**
 * @notice Returns true if subject passes the given custom scorer's threshold
 *         AND all required schemas are valid.
 * @dev Checks ScorerRegistry for requireAll schemas, then ScoreRegistry for score.
 */
function passesScorer(address subject, uint16 scorerId)
    external view
    returns (bool passes, string memory reason);
```

`PassportVerifier` needs `ScoreRegistry` and `ScorerRegistry` addresses injected at
construction. Add them as immutables. Do not make `PassportVerifier` upgradeable — it
was not before and shouldn't be now.

### 1.4 New Foundry Tests

Create `contracts/test/ScoreRegistry.t.sol` and `contracts/test/ScorerRegistry.t.sol`.

For `ScoreRegistry.t.sol` write tests for:
- `testCommitScore_succeeds` — SCORE_WRITER_ROLE commits a score, getScore returns it.
- `testCommitScore_revertsIfNotWriter` — non-writer reverts with `AccessControl` error.
- `testIsScoreValid_falseWhenExpired` — set expiresAt in the past, assert false.
- `testIsHuman_belowThreshold` — score 150 (< 200 threshold), assert false.
- `testIsHuman_aboveThreshold` — score 250, assert true.
- `testBatchCommitScore` — batch 5 subjects, assert all stored correctly.
- `testSetHumanityThreshold` — admin changes threshold, assert new value takes effect.

For `ScorerRegistry.t.sol`:
- `testRegisterScorer` — register, assert scorerId = 1 (0 reserved), check config.
- `testUpdateScorer_onlyOwner` — non-owner update reverts.
- `testDeactivateScorer` — deactivated scorer returns active = false.
- `testGetScorer_zeroId` — scorerId 0 returns canonical ArcPass scorer.

### 1.5 Deployment Script

Create `contracts/script/DeployScoreLayer.s.sol`:

```
Deploy order:
1. Deploy ScorerRegistry (no proxy needed — immutable by design).
2. Register canonical scorer (scorerId 0): name="ArcPass Global", threshold=200,
   weights for all 24 ArcPass schema IDs using the default weight table below.
3. Deploy ScoreRegistry implementation + ERC1967 proxy.
4. Initialize ScoreRegistry with SCORE_WRITER_ROLE assigned to the backend
   Circle wallet address (loaded from env CIRCLE_SCORE_WRITER_WALLET_ADDRESS).
5. Deploy new PassportVerifier with (AttestationRegistry, SchemaRegistry,
   ScoreRegistry, ScorerRegistry) addresses.
6. Write deployed addresses to deployments/arcpass-score-layer.json.
```

**Default weight table for canonical scorer (scorerId 0).** These weights are uint8
values 0–100, representing relative contribution. The backend normalises to a 0–1000
point scale.

```
Identity & Passport:
  BASIC_IDENTITY          weight: 50
  LIVENESS_VERIFIED       weight: 80

KYC / Compliance:
  KYC_BASIC               weight: 60
  AML_SCREENING           weight: 70
  ACCREDITED_INVESTOR     weight: 90
  AGE_OVER_18             weight: 40

Professional Credentials:
  CERTIFICATION           weight: 55
  LICENSE                 weight: 65
  SKILL_ENDORSEMENT       weight: 35

DAO & Governance:
  DAO_MEMBERSHIP          weight: 45
  GOVERNANCE_PARTICIPATION weight: 60
  DELEGATE                weight: 70

Reputation & Trust:
  REPUTATION_SCORE        weight: 75
  POSITIVE_INTERACTION    weight: 30
  DISPUTE_RECORD          weight: -20   ← negative weight, deducts from score

Employment & HR:
  EMPLOYMENT_RECORD       weight: 60
  INCOME_BAND             weight: 50
  CONTRACTOR_RECORD       weight: 40

Education:
  DEGREE                  weight: 55
  COURSE_COMPLETION       weight: 30
  BOOTCAMP_GRADUATE       weight: 25

Social Verification:
  SOCIAL_ACCOUNT          weight: 20
  HUMANITY_PROOF          weight: 85
  FOLLOWER_MILESTONE      weight: 15

Custom / Open:
  CUSTOM                  weight: 10
```

Implement negative weight support in score computation. A DISPUTE_RECORD deducts
20 points from the raw total before normalisation. If total goes below 0, floor at 0.

---

## Part 2 — Backend

### 2.1 New Service: `services/scoreService.ts`

This is the core score computation engine. It is the ArcPass equivalent of Human
Passport's off-chain scorer.

```typescript
/**
 * scoreService.ts
 *
 * Responsibilities:
 * 1. Load scorer configuration (weights, threshold, requireAll) from ScorerRegistry
 *    on-chain OR from in-memory canonical config (scorerId 0 always served from
 *    constants to avoid RPC calls on every request).
 * 2. Fetch all valid claims for a subject from the claim indexer + re-validate
 *    each via on-chain isValid() multicall (advisory index, authoritative chain).
 * 3. Apply deduplication: for each (schemaId, issuer) pair, only the most recently
 *    issued non-revoked non-expired claim counts. If the same schemaId was claimed
 *    by two different issuers, BOTH count (different issuers = different trust signals).
 * 4. Compute raw score: sum weight * claimPresent for each schema. Apply negatives.
 *    Clamp to [0, MAX_RAW].
 * 5. Normalise to 0–1000 scale: normScore = Math.round((rawScore / MAX_RAW) * 1000).
 * 6. Evaluate requireAll: for each schemaId in requireAll, verify a valid claim exists.
 *    If any required schema is missing → passesScorer = false regardless of score.
 * 7. Return a ScorerResult object (see type below).
 * 8. Commit the score to ScoreRegistry on-chain via Circle SDK if commitOnChain=true.
 *    Score commitment = keccak256(subject + scorerId + score + computedAt).
 *    ExpiresAt = computedAt + 24 hours (configurable via SCORE_TTL_SECONDS env var).
 * 9. Cache results in-memory (LRU, max 1000 entries, TTL = SCORE_CACHE_TTL_SECONDS
 *    default 300). Cache key: `score:${subject}:${scorerId}`.
 */

export interface ScorerResult {
  subject: string;           // checksummed address
  scorerId: number;          // 0 = global
  score: number;             // 0–1000 (display: divide by 10 for 0.0–100.0)
  displayScore: string;      // "82.5" (string, one decimal)
  threshold: number;         // scorer's threshold (0–1000 scale)
  passes: boolean;           // score >= threshold AND requireAll satisfied
  isHuman: boolean;          // scorerId 0 only: passes global humanity check
  computedAt: number;        // unix timestamp
  expiresAt: number;         // unix timestamp
  breakdown: SchemaBreakdown[];
  requireAllStatus: RequireAllStatus[];
  deduplicationLog: DedupEntry[];
  onChainCommitted: boolean;
  commitment?: string;       // bytes32 hex
}

export interface SchemaBreakdown {
  schemaId: string;          // bytes32 hex
  schemaName: string;        // human label from constants/schemas.ts
  category: string;          // service vertical
  weight: number;            // raw weight from scorer config
  hasValidClaim: boolean;
  pointsContributed: number; // actual points after normalisation (can be negative)
  claimId?: string;          // bytes32 of the active claim
  issuedBy?: string;         // issuer address
  expiresAt?: number;
}

export interface RequireAllStatus {
  schemaId: string;
  schemaName: string;
  satisfied: boolean;
}

export interface DedupEntry {
  schemaId: string;
  duplicateClaimIds: string[];
  keptClaimId: string;
  reason: string;
}
```

Implementation notes:
- Import the canonical 24 schema configs from `constants/schemas.ts`. Do NOT hardcode
  schema IDs as strings in this file.
- Use the existing `claimIndexer` for initial data. Re-validate with `multicall` against
  `AttestationRegistry.isValid()` — same pattern as `passportService.ts`.
- Use `viem`'s `encodePacked` + `keccak256` for the score commitment. Match the Solidity
  computation exactly. Write a unit test that compares the TypeScript output with the
  Solidity output using `forge test`.
- Circle SDK write for on-chain commitment: wrap in `executeContractCall` with
  `assertBlockchain()` guard, same pattern as existing contract writes.
- Export `computeScore(subject, scorerId, commitOnChain): Promise<ScorerResult>` as the
  primary function.
- Export `computeScoreBatch(subjects[], scorerId, commitOnChain): Promise<ScorerResult[]>`
  for batch scoring (used by bulk issuer tools).

### 2.2 New Service: `services/scorerConfigService.ts`

```typescript
/**
 * scorerConfigService.ts
 *
 * Loads and caches ScorerRegistry configurations from on-chain.
 *
 * Functions:
 * - getScorerConfig(scorerId): Promise<ScorerConfig>
 *   - scorerId 0: return from LOCAL constants (no RPC call, always fresh).
 *   - scorerId > 0: call ScorerRegistry.getScorer(scorerId) on-chain, cache
 *     in-memory (LRU 500 entries, TTL 600s).
 * - invalidateScorerCache(scorerId): void
 *   - Called when a ScorerUpdated event is detected by the indexer.
 * - listKnownScorers(): Promise<ScorerConfig[]>
 *   - Returns scorers 0 through ScorerRegistry.scorerCount().
 *
 * Types:
 * export interface ScorerConfig {
 *   scorerId: number;
 *   name: string;
 *   owner: string;
 *   threshold: number;
 *   schemaWeights: Record<string, number>; // schemaId hex → weight
 *   requireAll: string[];                  // schemaId hex[]
 *   active: boolean;
 * }
 */
```

### 2.3 New API Routes: `routes/score.ts`

Mount at `/v1/score`. All routes require no auth unless noted.

```
GET  /v1/score/:address
     → computeScore(address, scorerId=0, commitOnChain=false)
     → Returns ScorerResult (JSON)
     Query params:
       scorerId?: number  (default 0)
       commit?: boolean   (default false — set true to write score on-chain,
                           requires ISSUER auth via existing signed-message middleware)
     Cache-Control: max-age=300

GET  /v1/score/:address/breakdown
     → Same as above but returns full breakdown[] and deduplicationLog[]
     → Useful for debugging and the Studio analytics page

POST /v1/score/:address/commit
     → Authenticated (ISSUER_ROLE via issuerGuard middleware)
     → Forces a score recompute + on-chain commit for the address
     → Returns ScorerResult with onChainCommitted: true
     → Body: { scorerId?: number }

GET  /v1/score/:address/history
     → Returns array of historical ScorerResult snapshots
     → Requires a persistence layer — store committed scores in
       score_history.jsonl (newline-delimited JSON, append-only)
       Same advisory-only pattern as the claim indexer.
     → Query params: scorerId?, limit? (default 20), since? (unix ts)

GET  /v1/scorers
     → Returns list of registered scorers from ScorerRegistry
     → Includes canonical scorer 0

GET  /v1/scorers/:scorerId
     → Returns single ScorerConfig

POST /v1/scorers
     → Authenticated (any wallet — caller becomes scorer owner on-chain)
     → Body: { name, threshold, schemaWeights, requireAll }
     → Calls ScorerRegistry.registerScorer() via Circle SDK
     → Returns { scorerId, txHash, config }

GET  /v1/score/:address/passes/:scorerId
     → Lightweight boolean check for access-gating
     → Returns { subject, scorerId, passes, score, threshold, computedAt }
     → This is the endpoint partner dApps poll for gate checks
     → Cache-Control: max-age=60 (shorter TTL — gating is latency-sensitive)

GET  /v1/score/:address/isHuman
     → Shorthand for scorerId=0 passes check
     → Returns { subject, isHuman, score, threshold }
```

**Error format** — all errors must return:
```json
{ "error": "SCORE_NOT_FOUND", "message": "No score computed for this address yet.",
  "hint": "POST /v1/score/:address/commit to trigger computation." }
```

### 2.4 Extend `services/passportService.ts`

The existing passport service builds the `PassportDocument`. Extend it to include score data:

```typescript
// Add to PassportDocument type:
export interface PassportDocument {
  // ... existing fields unchanged ...

  // NEW:
  humanityScore: {
    score: number;           // 0–1000
    displayScore: string;    // "82.5"
    threshold: number;       // 200 (= 20.0)
    passes: boolean;
    isHuman: boolean;
    computedAt: number;
    expiresAt: number;
    onChain: boolean;        // true if committed to ScoreRegistry
    breakdown: SchemaBreakdown[];
  } | null;                  // null if score not yet computed
}
```

In `buildPassportDocument()`:
1. After fetching and validating claims (existing logic), call
   `scoreService.computeScore(subject, 0, false)`.
2. Set `humanityScore` from the result.
3. Do NOT commit on-chain from this function — passport assembly is read-only.
4. If scoreService throws, set `humanityScore = null` and log the error. Do not let a
   score failure break passport assembly.

### 2.5 Extend Claim Indexer: `indexer/claimIndexer.ts`

Add two new event watchers:

```typescript
// Watch ScorerRegistry.ScorerRegistered and ScorerRegistry.ScorerUpdated
// → On ScorerUpdated: call scorerConfigService.invalidateScorerCache(scorerId)
// → On ScorerRegistered: log "New scorer registered: scorerId=${scorerId}"

// Watch ScoreRegistry.ScoreCommitted
// → On ScoreCommitted: append to score_history.jsonl:
//   { subject, scorerId, score, computedAt, expiresAt, commitment, blockNumber }
```

### 2.6 Extend Monitoring: `monitoring/eventMonitor.ts`

Add alerts:
- `humanityScoreAnomaly`: if avg score across last 100 computations drops > 30% in 1 hour.
  Possible Sybil flood attack — alert immediately.
- `scoreWriterBalanceLow`: monitor Circle wallet balance for SCORE_WRITER_ROLE.
  Same pattern as existing issuer wallet balance monitoring.

### 2.7 Schema Parity — Extend `schemaHash.ts`

The existing `SchemaIdParity.t.sol` verifies all 24 schema IDs match between Solidity and
TypeScript. After adding weight configuration:

Extend `constants/schemas.ts` to export:
```typescript
export interface CanonicalSchema {
  id: string;        // bytes32 hex, keccak256 computed
  name: string;
  version: string;
  fields: SchemaField[];
  category: ServiceVertical;
  defaultWeight: number;   // NEW: 0–100, used for canonical scorer (scorerId 0)
  isNegative: boolean;     // NEW: true for DISPUTE_RECORD etc.
}
```

The `defaultWeight` values must match the deployment script's canonical scorer
configuration exactly. Add a unit test `test/scoreWeightParity.test.ts` that asserts
`constants/schemas.ts` weights match `CANONICAL_SCORER_WEIGHTS` in the deployment
script. This prevents silent drift between the off-chain scorer and on-chain config.

---

## Part 3 — Frontend

### 3.1 New Hook: `hooks/useHumanityScore.ts`

```typescript
/**
 * useHumanityScore(address: string, scorerId?: number)
 *
 * Fetches the ArcPass Humanity Score for a given address.
 *
 * Strategy:
 * 1. First: read score from ScoreRegistry on-chain via useReadContract
 *    → PassportVerifier.getScore(address, scorerId)
 *    → If isValid = true: use on-chain score as authoritative.
 * 2. If on-chain score is expired or doesn't exist: call backend
 *    GET /v1/score/:address?scorerId=scorerId
 *    → Returns latest computed score (may not be on-chain yet).
 * 3. Returns: { score, displayScore, threshold, passes, isHuman, isLoading,
 *              isOnChain, computedAt, expiresAt, breakdown, error }
 *
 * Re-fetches when address or scorerId changes.
 * Stale-while-revalidate: show cached data while refetching.
 */
```

### 3.2 New Hook: `hooks/useScorerPasses.ts`

```typescript
/**
 * useScorerPasses(address: string, scorerId: number)
 *
 * Lightweight boolean pass/fail for access gating checks.
 * Uses GET /v1/score/:address/passes/:scorerId
 * Returns: { passes, score, threshold, isLoading, error }
 * Polls every 30 seconds if the user is on the page (for live gating UX).
 */
```

### 3.3 New Component: `components/HumanityScoreCard.tsx`

The centrepiece UI component. Used on `/passport/:address` and Studio overview.

**Visual spec:**

```
┌──────────────────────────────────────────────────────────────┐
│  HUMANITY SCORE                                              │
│                                                              │
│       ┌──────────────────────────────────────────┐          │
│       │                                          │          │
│       │              82.5                        │          │
│       │         ─────────────                    │          │
│       │              / 100                       │          │
│       │                                          │          │
│       │  [████████████████████░░░░░░░░]  82%     │          │
│       │   Threshold: 20.0  ●  PASSES             │          │
│       │                                          │          │
│       └──────────────────────────────────────────┘          │
│                                                              │
│  ● On-chain committed · Updated 5 min ago · Expires 19h     │
│                                                              │
│  BREAKDOWN                              [Expand ▾]          │
│  ─────────────────────────────────────────────────          │
│  Identity & Passport         ████░░░░  8.0 / 10.0 pts       │
│  KYC / Compliance            ██████░░  12.0 / 16.0 pts      │
│  Reputation & Trust          ████████  18.0 / 18.0 pts ✓    │
│  DAO & Governance            ██░░░░░░  4.0 / 14.0 pts       │
│  ... collapsed ...                                           │
│                                                              │
│  [Refresh score]      [Commit on-chain]   [Share passport]  │
└──────────────────────────────────────────────────────────────┘
```

Implementation details:

**Score ring / number:**
- Display `score / 10` with one decimal: `825` → `"82.5"`.
- Font: Space Grotesk 700, `--text-hero` size (56px on desktop, 36px mobile).
- "/ 100" in `--color-subtle`, `--text-xl`.
- Below the score: a horizontal progress bar, 100% width, 8px height, `--radius-sm`.
  - Fill: gradient from `--color-arc-primary` (left) to `--color-verified` (right),
    width = `${score/10}%`.
  - Track: `--color-surface-2`.
  - A 2px vertical tick mark at the threshold position: `--color-warn`.
  - Label at tick: `Threshold: 20.0` in mono `--text-xs --color-subtle`.

**PASSES / FAILS chip:**
- PASSES: `--color-verified` text + mint border. `PASSES ✓`.
- FAILS: `--color-danger` text + red border. `FAILS ✗`.

**On-chain indicator:**
- `● On-chain committed`: mint dot + mono `--text-xs` with relative timestamp.
- `○ Not committed`: `--color-subtle` dot + "Score computed locally. Commit to chain for permanence."
- `[Commit on-chain]` button: shown only if user is viewing their own passport AND is
  the subject address (compare `useAccount().address` with route `:address`).

**Breakdown table:**
- Collapsed by default. Click "Expand ▾" to reveal.
- Rows per category (not per schema — aggregate by category first, then expand per schema
  if user clicks a category row).
- Category row: `category label | progress bar | pts / max pts`.
- Progress bar fill: if all max pts earned → `--color-verified`. Partial → `--color-arc-primary`.
  Zero → `--color-surface-2` fill (empty bar).
- Negative schema (DISPUTE_RECORD): show in `--color-danger` with `-X.X pts` label.

**"Refresh score" button:**
- Calls GET /v1/score/:address?commit=false, invalidates TanStack Query cache for
  `['score', address, scorerId]`. Shows spinner in place of button while loading.

**Component state machine:**
```
loading → show skeleton (3 bar shimmer, same width as the final card)
error   → show error card (Backend unavailable pattern from FRONTEND_DESIGN.md)
no-data → empty state: "Score not yet computed. Request computation below."
          + [Compute score] button → POST /v1/score/:address/commit
data    → full card as above
```

### 3.4 New Component: `components/ScorerPassesGate.tsx`

A drop-in guard component for conditionally rendering content based on scorer result.

```tsx
interface ScorerPassesGateProps {
  address: string;
  scorerId?: number;            // default 0
  fallback?: React.ReactNode;   // shown when fails
  skeleton?: React.ReactNode;   // shown while loading
  children: React.ReactNode;    // shown when passes
}

// Usage:
<ScorerPassesGate address={userAddress} scorerId={0}>
  <GrantClaimButton />
</ScorerPassesGate>
```

This is the building block for access-gated UIs in ArcPass itself and for the Embed SDK.

### 3.5 New Page: `pages/ScorePage.tsx` → route `/score/:address`

A dedicated public score page. Shareable URL like `/passport/:address`.

```
Layout: max-width 720px centered

HUMANITY SCORE
◈ ArcPass Score for 0x04e0...DB1b

[HumanityScoreCard full component]

CUSTOM SCORER CHECK
──────────────────────────────────────────────────
Enter a scorer ID to check if this address passes:

┌──────────────────────────────────┐
│  Scorer ID  [    1            ]  │
│             [Check  ]            │
└──────────────────────────────────┘

Result:
┌──────────────────────────────────────────────────┐
│  MyDAO Governance Scorer (ID: 1)                 │
│  Threshold: 45.0                                 │
│  Score: 38.2                           FAILS ✗   │
│  Missing required: DAO_MEMBERSHIP                │
└──────────────────────────────────────────────────┘
```

Add "Score" link to the main navbar between "Verify" and "Issue":
```
Home  Guide  Register  Schema  Passport  Score  Verify  Issue  Studio
```

### 3.6 Extend `pages/PassportPage.tsx`

On the public passport (`/passport/:address`), integrate `HumanityScoreCard` above the
credentials section:

```
[Passport header — existing]
[Service badge strip — existing]

─── Humanity Score ──────────────────────────────
[HumanityScoreCard — NEW]

─── Credentials ─────────────────────────────────
[Existing credential cards]
```

No other changes to PassportPage structure. HumanityScoreCard is additive.

### 3.7 Studio — Extend Analytics (`/studio/analytics`)

Add a "Score Overview" section below the existing analytics grid:

```
SCORE DISTRIBUTION (last 100 subjects with computed scores)
──────────────────────────────────────────────────────────

  0–20    ██░░░░░░░░  8%
  20–40   ████░░░░░░  18%
  40–60   ██████░░░░  31%
  60–80   ████████░░  28%
  80–100  ████░░░░░░  15%

  Avg score: 57.3   Median: 61.0   Human rate: 72%
```

Data source: GET /v1/score/distribution endpoint (add to backend — queries
score_history.jsonl, aggregates in-process, returns histogram + stats).

### 3.8 New Component: `components/ScorerBuilder.tsx`

Add a "Scorers" tab to ArcPass Studio (`/studio/scorers`).

Allows issuers to:
1. View registered scorers.
2. Register a new custom scorer with the weight configurator.
3. Update their own scorers.

```
CUSTOM SCORERS
─────────────────────────────────────────────────

[+ New scorer]

┌─────────────────────────────────────────────────┐
│  MyDAO Scorer  (ID: 1)              owner: you  │
│  Threshold: 45.0  ·  4 required schemas  ACTIVE │
│                             [Edit]  [Deactivate] │
└─────────────────────────────────────────────────┘

NEW SCORER FORM:
  Name:          [                          ]
  Threshold:     [20.0] (0.0 – 100.0)

  Schema Weights:
  ┌────────────────────────────────────────────┐
  │  kyc_basic         [████████░░] 80         │
  │  liveness_verified [█████░░░░░] 50         │
  │  ...                                       │
  │  [+ Add schema]                            │
  └────────────────────────────────────────────┘

  Required schemas (must all be present):
  [kyc_basic ✕] [liveness_verified ✕] [+ Add]

  [Register on-chain]  ← PRIMARY button
  [Preview score simulation]  ← shows what score a test address would get
```

Weight sliders: range input, styled as a horizontal track with a draggable thumb.
Track fill: `--color-arc-primary`. Same height as the progress bars in HumanityScoreCard (8px).

---

## Part 4 — Embed SDK (New Package)

### 4.1 Package: `packages/arcpass-embed`

Create a standalone publishable npm package for partner dApp integration.
This is the ArcPass equivalent of Human Passport Embed.

```
packages/arcpass-embed/
  src/
    ArcPassVerify.tsx       ← main embed component
    useArcPassScore.ts      ← hook re-exported for headless usage
    ArcPassProvider.tsx     ← context provider (chain config, scorer config)
    types.ts
    index.ts                ← public exports
  package.json
  tsconfig.json
  README.md
```

**`ArcPassVerify.tsx` component:**

```tsx
interface ArcPassVerifyProps {
  // Required
  address: string;           // subject wallet address
  scorerId?: number;         // default 0 (global ArcPass scorer)
  
  // Theming — partner can override to match their brand
  accentColor?: string;      // default #00E5A0
  theme?: 'dark' | 'light';  // default 'dark'
  
  // Callbacks
  onPass?: (result: ScorerResult) => void;
  onFail?: (result: ScorerResult) => void;
  onError?: (error: Error) => void;
  
  // Display options
  showBreakdown?: boolean;   // default false
  showCommitButton?: boolean; // default false
  compact?: boolean;         // compact mode: just score + pass/fail chip, no breakdown
}
```

**Compact mode renders:**
```
┌────────────────────────────────┐
│  ◈ ArcPass   82.5    PASSES ✓ │
└────────────────────────────────┘
Width: 280px. Height: 48px. Used as an inline badge in partner UIs.

**Full mode:** Same as `HumanityScoreCard` but scoped/isolated CSS (CSS-in-JS or
CSS Modules with a unique namespace prefix `arcpass-embed__` to avoid collisions).

The embed makes API calls to `https://api.arcpass.xyz` (production) or a configurable
`apiBase` prop for local dev.

**`ArcPassProvider.tsx`:**
```tsx
<ArcPassProvider
  apiBase="https://api.arcpass.xyz"
  chainId={5042002}
  scorerId={1}           // partner's custom scorer
>
  {children}
</ArcPassProvider>
```

Partners wrap their app in `ArcPassProvider` once, then use `<ArcPassVerify />` anywhere.

### 4.2 Embed README

Write `packages/arcpass-embed/README.md` covering:
- Installation: `npm install @arcpass/embed`
- Quick start (3 lines of code)
- `ArcPassProvider` props table
- `ArcPassVerify` props table
- `useArcPassScore` hook signature
- Custom scorer setup link (links to ArcPass Studio)
- On-chain vs off-chain score difference explanation
- Rate limits (reference the API's Cache-Control headers)

---

## Part 5 — Infrastructure

### 5.1 New Environment Variables

Add to `.env.example` (backend):
```bash
# Score layer
SCORE_REGISTRY_ADDRESS=0x...
SCORER_REGISTRY_ADDRESS=0x...
CIRCLE_SCORE_WRITER_WALLET_ID=wallet_...   # Circle wallet with SCORE_WRITER_ROLE

# Score computation
SCORE_TTL_SECONDS=86400        # 24 hours — how long a committed score is valid
SCORE_CACHE_TTL_SECONDS=300    # 5 min in-memory cache for score results
HUMANITY_THRESHOLD=200         # 200 = 20.0 on display scale. Must match on-chain value.

# Embed SDK
ARCPASS_EMBED_ALLOWED_ORIGINS=https://example-partner.com,https://anotherdapp.xyz
```

### 5.2 Score History Persistence

`score_history.jsonl` — append-only newline-delimited JSON log.

```jsonl
{"subject":"0x...","scorerId":0,"score":825,"computedAt":1718000000,"expiresAt":1718086400,"commitment":"0x...","blockNumber":null,"source":"api"}
{"subject":"0x...","scorerId":0,"score":825,"computedAt":1718086500,"expiresAt":1718172900,"commitment":"0x...","blockNumber":12345678,"source":"chain"}
```

`source`: `"api"` (computed but not yet committed) | `"chain"` (from ScoreCommitted event).

This file is advisory only — same contract as the claim indexer. On startup, the
score service does NOT need to replay this file. It is for analytics and history API
only.

Add `score_history.jsonl` to `.gitignore`. Add to `.gitignore.example` the pattern for
operators running their own nodes.

### 5.3 API Rate Limiting — Extend Existing

The existing auth middleware has nonce-based replay prevention. Extend it for score endpoints:

```
GET /v1/score/* routes:
  Rate limit: 60 req/min per IP, 300 req/min per authenticated address
  Burst: 10 req/s per IP

POST /v1/score/:address/commit:
  Requires valid signed-message auth (existing middleware)
  Rate limit: 5 req/min per address (score commits are expensive — on-chain tx)
  Return 429 with Retry-After header on limit hit

GET /v1/score/:address/passes/:scorerId:
  Rate limit: 120 req/min per IP (higher — partner dApps poll this for gating)
  Cache-Control: max-age=60, stale-while-revalidate=300
```

### 5.4 CORS — Extend for Embed SDK

The existing backend restricts CORS to known origins. Extend:

```typescript
// middleware/cors.ts (extend existing)
const EMBED_ALLOWED_ORIGINS = process.env.ARCPASS_EMBED_ALLOWED_ORIGINS
  ?.split(',')
  .map(o => o.trim()) ?? [];

// /v1/score/* routes allow EMBED_ALLOWED_ORIGINS in addition to the standard
// allowed origins. Preflight handled correctly (OPTIONS method returns 204).
```

### 5.5 OpenAPI Spec — Extend `openapi.json`

Add all new `/v1/score/*` and `/v1/scorers/*` endpoints to the existing OpenAPI spec.
The Studio's "API Docs (Swagger)" and "openapi.json" buttons already link to this file.

For each new endpoint document:
- Summary and description
- Path parameters with types
- Query parameters with defaults
- Request body schema (for POST routes)
- Response schema (reference `ScorerResult` as a reusable `#/components/schemas/ScorerResult`)
- Error responses: 400, 401, 404, 429, 500

---

## Part 6 — Testing Strategy

### 6.1 Backend Unit Tests (`vitest`)

Create `backend/test/score/`:

```
scoreService.test.ts
  - testComputeScore_noClaimsReturnsZero
  - testComputeScore_singleValidClaim_correctWeight
  - testComputeScore_negativeWeightDeducts
  - testComputeScore_expiredClaimExcluded
  - testComputeScore_deduplication_sameSchemaMultipleIssuers_bothCount
  - testComputeScore_deduplication_sameIssuer_onlyLatestCounts
  - testComputeScore_requireAll_missingSchema_fails_evenWithHighScore
  - testComputeScore_normalisationClampsAt1000
  - testCommitmentHash_matchesSolidityOutput  ← run against anvil fork

scorerConfigService.test.ts
  - testGetScorerConfig_scorerIdZero_fromConstants_noRPCCall
  - testGetScorerConfig_nonZeroId_callsOnChain
  - testInvalidateCache_subsequentCallFetchesFresh

scoreWeightParity.test.ts
  - testDefaultWeights_matchDeploymentScript  ← the drift prevention test
```

### 6.2 API Integration Tests

Create `backend/test/routes/score.test.ts`:

- Mock the scoreService and test HTTP responses (status codes, response shape).
- Test rate limiting middleware fires 429 after limit.
- Test CORS headers on /v1/score/* from embed-allowed origin.
- Test auth guard on POST /v1/score/:address/commit.

### 6.3 Frontend Tests (`vitest` + React Testing Library)

Create `frontend/src/components/__tests__/`:

```
HumanityScoreCard.test.tsx
  - renders loading skeleton when isLoading=true
  - renders error card when error is set
  - renders empty state when score=null
  - renders correct displayScore (825 → "82.5")
  - shows PASSES chip when passes=true
  - shows FAILS chip when passes=false
  - breakdown expands on click
  - commit button visible only when viewerIsSubject

ScorerPassesGate.test.tsx
  - renders children when passes=true
  - renders fallback when passes=false
  - renders skeleton while loading
```

### 6.4 Foundry Integration Test

Create `contracts/test/integration/ScoreLayerIntegration.t.sol`:

```solidity
/**
 * Full flow:
 * 1. Deploy AttestationRegistry, SchemaRegistry, ScoreRegistry,
 *    ScorerRegistry, PassportVerifier.
 * 2. Register canonical scorer (scorerId 0).
 * 3. Issue 3 attestations to a subject (KYC_BASIC, LIVENESS_VERIFIED, REPUTATION_SCORE).
 * 4. Commit score 650 for the subject.
 * 5. Assert PassportVerifier.getScore(subject, 0) returns (650, true, true).
 *    isHuman = true because 650 >= HUMANITY_THRESHOLD (200).
 * 6. Register a custom scorer (scorerId 1) requiring DAO_MEMBERSHIP.
 * 7. Assert PassportVerifier.passesScorer(subject, 1) returns (false, "Missing DAO_MEMBERSHIP").
 * 8. Issue DAO_MEMBERSHIP attestation. Commit updated score 750.
 * 9. Assert passesScorer(subject, 1) returns (true, "").
 * 10. Revoke KYC_BASIC. Commit updated score 590.
 * 11. Assert isHuman still true (590 >= 200).
 * 12. Expire score (warp block.timestamp past expiresAt).
 * 13. Assert isScoreValid(subject, 0) = false.
 * 14. Assert isHuman(subject) = false (expired score = not human).
 */
```

---

## Part 7 — Naming, Constants, and Conventions

### 7.1 ScorerId Constants

Define in `constants/scorers.ts` (both backend and frontend, keep in sync):

```typescript
export const SCORER_IDS = {
  ARCPASS_GLOBAL:     0,    // canonical, always present
  // Custom scorer IDs are dynamic (registered by dApps) — not hardcoded here
} as const;

export const SCORE_SCALE = 1000;       // raw score range 0–1000
export const SCORE_DISPLAY_DIVISOR = 10; // raw 825 → display "82.5"
export const HUMANITY_THRESHOLD_RAW = 200; // raw, = 20.0 display
```

### 7.2 API Route Constants

Define in `constants/routes.ts` (backend):

```typescript
export const SCORE_ROUTES = {
  GET_SCORE:       '/v1/score/:address',
  GET_BREAKDOWN:   '/v1/score/:address/breakdown',
  COMMIT_SCORE:    '/v1/score/:address/commit',
  GET_HISTORY:     '/v1/score/:address/history',
  PASSES_SCORER:   '/v1/score/:address/passes/:scorerId',
  IS_HUMAN:        '/v1/score/:address/isHuman',
  LIST_SCORERS:    '/v1/scorers',
  GET_SCORER:      '/v1/scorers/:scorerId',
  REGISTER_SCORER: '/v1/scorers',
  SCORE_DIST:      '/v1/score/distribution',
} as const;
```

### 7.3 Error Codes

Define in `constants/errors.ts` (backend):

```typescript
export const SCORE_ERRORS = {
  SCORE_NOT_FOUND:        'SCORE_NOT_FOUND',
  SCORE_EXPIRED:          'SCORE_EXPIRED',
  SCORER_NOT_FOUND:       'SCORER_NOT_FOUND',
  SCORER_INACTIVE:        'SCORER_INACTIVE',
  COMPUTATION_FAILED:     'SCORE_COMPUTATION_FAILED',
  COMMIT_FAILED:          'SCORE_COMMIT_FAILED',
  RATE_LIMITED:           'RATE_LIMITED',
} as const;
```

---

## Part 8 — Execution Order

Do NOT attempt all parts at once. Implement in this strict sequence. Each phase must
pass its tests before the next begins.

```
Phase 1 — Contracts (no UI dependency, safe to build first)
  1. ScorerRegistry.sol
  2. ScoreRegistry.sol
  3. PassportVerifier.sol extensions
  4. Foundry tests (all must pass: forge test --match-path "*/score*")
  5. DeployScoreLayer.s.sol (deploy to Arc Testnet, record addresses)

Phase 2 — Backend (depends on Phase 1 addresses)
  1. constants/schemas.ts — add defaultWeight, isNegative
  2. constants/scorers.ts
  3. services/scorerConfigService.ts
  4. services/scoreService.ts (off-chain computation only, no on-chain commit yet)
  5. routes/score.ts (GET /v1/score/:address only, others stubbed 501)
  6. Run: npm test — score computation tests must pass
  7. services/scoreService.ts — add on-chain commitment via Circle SDK
  8. Extend passportService.ts
  9. Extend claimIndexer.ts
  10. All remaining score routes (commit, history, passes, isHuman, scorers)
  11. Extend openapi.json
  12. All backend tests must pass: npm test

Phase 3 — Frontend (depends on Phase 2 API running)
  1. hooks/useHumanityScore.ts
  2. hooks/useScorerPasses.ts
  3. components/HumanityScoreCard.tsx (loading/error/empty/data states)
  4. Extend PassportPage.tsx (add HumanityScoreCard above credentials)
  5. pages/ScorePage.tsx + route /score/:address
  6. Navbar: add "Score" link
  7. components/ScorerPassesGate.tsx
  8. Studio: ScorerBuilder tab + Analytics score distribution section
  9. Frontend component tests must pass: npm test

Phase 4 — Embed SDK (depends on Phase 2 and 3)
  1. packages/arcpass-embed scaffold
  2. ArcPassProvider.tsx
  3. ArcPassVerify.tsx (compact + full mode)
  4. useArcPassScore.ts
  5. README.md
  6. Manual integration test in a minimal Vite sandbox

Phase 5 — Integration Test
  1. contracts/test/integration/ScoreLayerIntegration.t.sol
  2. End-to-end: anvil fork → deploy → issue claims → compute score →
     commit on-chain → read from frontend hook → verify HumanityScoreCard renders.
```

---

## Constraints and Non-Negotiables

1. **Do not change any existing contract ABI.** Extensions only. Existing tests must still pass.
2. **Do not change any existing API route signature or response shape.** Only add new fields
   to existing responses (e.g. `humanityScore` in PassportDocument is additive).
3. **Circle SDK for all on-chain writes from the backend.** No raw `walletClient.writeContract`
   anywhere in the backend codebase.
4. **`assertBlockchain()` guard on every contract write.** This is existing convention — maintain it.
5. **Score is advisory until committed on-chain.** Never show a score as "verified" in the UI
   unless `onChain: true` in the ScorerResult. Use "computed" or "estimated" for off-chain scores.
6. **`--color-verified` (`#00E5A0`) only for on-chain confirmed states.** An off-chain computed
   score that hasn't been committed must NOT use the mint green. Use `--color-warn` amber instead
   with a label "Not yet committed on-chain."
7. **No PII stored anywhere.** Score history stores addresses and scores. No names, no email,
   no raw credential data. This is enforced at the schema and API validation layers.
8. **Deduplication is not punishment.** If the same issuer re-issues a schema credential to the
   same subject, keep the newest valid claim. The old one's revocation triggers the re-issue.
   Log the dedup decision in `deduplicationLog` transparently.
9. **Negative weights are bounded.** A subject's score cannot go below 0 regardless of how many
   negative-weighted schemas they have. `Math.max(0, rawTotal)` before normalisation.
10. **The Embed SDK must have zero runtime dependencies** beyond React and viem. Bundle size
    matters for partner adoption.

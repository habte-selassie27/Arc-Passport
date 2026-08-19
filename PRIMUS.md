# PRIMUS.md — Primus Labs zkTLS Integration

Primus Labs integration lets users cryptographically prove ownership of Web2 accounts
(GitHub, Twitter/X, Discord, email, CEX balance) using zero-knowledge TLS proofs. The
raw data never leaves the user's device — only a cryptographic proof is verified and
recorded on-chain as a `WEB2_DATA_PROOF` attestation.

```
Select Template → Start Verification → Primus OAuth → zkTLS Proof → Backend Verify → On-chain Attestation
```

## Architecture

```
Frontend                    Backend                       Primus Labs API
   │                            │                              │
   ├─ POST /web2-proof/start ──►│── POST /v1/tasks ──────────►│
   │◄── { verificationId, url } │◄── { taskId, authUrl } ─────│
   │                            │                              │
   │  (user completes auth in   │                              │
   │   new tab via Primus)      │                              │
   │                            │                              │
   ├─ POST /web2-proof/callback►│                              │
   │   { taskId, verificationId }│── GET /v1/tasks/:taskId ───►│
   │                            │◄── { verified, dataHash } ──│
   │                            │                              │
   │                            │── attest() on-chain ────────►│
   │◄── { state: "complete" }   │                              │
```

## Components

### Contract: `Web2DataGate`

`contracts/src/services/verifiers/Web2DataGate.sol`

Stateless gate contract — mirrors `HumanityGate`. Reads the `AttestationRegistry` to
check if a subject holds a valid `WEB2_DATA_PROOF` attestation.

```solidity
function isWeb2Verified(address subject) public view returns (bool)
function requireWeb2Verified(address subject) public view
```

### Schema: `WEB2_DATA_PROOF`

Registered in `SOCIAL_SCHEMAS` (`backend/src/constants/schemas.ts`):

```typescript
WEB2_DATA_PROOF: {
  id: keccak256("arcpass_web2_data_proof" + "1.0.0" + fieldsJson),
  name: "arcpass_web2_data_proof",
  version: "1.0.0",
  fields: [
    { name: "verified", type: "bool", visibility: "PUBLIC" },
    { name: "provider", type: "string", visibility: "PUBLIC" },
    { name: "templateId", type: "string", visibility: "PUBLIC" },
    { name: "dataHash", type: "bytes32", visibility: "PRIVATE" },
    { name: "checkedAt", type: "uint64", visibility: "PUBLIC" },
  ],
}
```

`dataHash` is `PRIVATE` — a keccak256 commitment to the verified data. The raw Web2
data never appears on-chain.

### Provider Adapter (`backend/src/services/primusProvider.ts`)

```typescript
interface PrimusProvider {
  createVerificationTask(params): Promise<TaskCreationResult>;
  verifyProof(taskId): Promise<VerificationResult>;
}
```

- **`PrimusApiProvider`** — real HTTP client for Primus Labs API. Uses HMAC-signed
  requests (placeholder in current implementation — production should use the Primus SDK).
- **`MockPrimusProvider`** — deterministic mock for tests. Returns incrementing task IDs
  and a fixed `dataHash`.

`getPrimusProvider()` returns the real provider when `PRIMUS_API_KEY`,
`PRIMUS_API_SECRET`, and `PRIMUS_REDIRECT_URI` are set; otherwise falls back to mock.

### Service (`backend/src/services/primusService.ts`)

State machine identical to Humanode:

```
initialized → pending → verified → attesting → complete
                                                  ↓
                                         failed / expired
```

**Key behaviors:**
- **Idempotent:** re-verifying an already-complete wallet returns the existing session
  (with a fresh auth URL) if the on-chain claim is still valid.
- **One-proof-per-provider:** `dataHash` acts as a nullifier. If a different wallet
  attempts to verify the same data (same `dataHash`), the callback is rejected with
  `ProviderAlreadyBound`. Same-subject re-verification is allowed (idempotent).
- **Expiration:** records past `expiresAt` are marked `expired` and cannot complete.
- **JSONL advisory store:** `.web2-proof-verifications.jsonl` — append-only log with
  in-memory read. Not authoritative for claim validity (on-chain `isValid()` is).

### Routes (`backend/src/routes/web2-proof.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/web2-proof/config` | No | Returns templates list and schema ID |
| `GET` | `/web2-proof/verify/:address` | No | Returns verification status for an address |
| `POST` | `/web2-proof/start` | Signed | Starts a new verification session |
| `GET` | `/web2-proof/status/:id` | Signed | Polls verification status |
| `POST` | `/web2-proof/callback` | Signed | Completes verification after Primus OAuth |

Write endpoints (`/start`, `/callback`) are rate-limited to 10 per address per minute.

### Frontend

- **`usePrimus.ts`** — hooks: `useWeb2ProofFlow` (start/poll/complete mutations),
  `useWeb2ProofStatus` (public read), `useWeb2ProofConfig` (templates list).
- **`Web2Proof.tsx`** — page with template selection, OAuth redirect, polling, and
  attestation display. Follows the same phase progression as HumanNode.

## Data Flow

1. **Select template** — user picks github-account, twitter-account, etc.
2. **Start** — frontend calls `POST /start` with signed auth. Backend creates a Primus
   task, stores the record, returns `verificationId` + `authUrl`.
3. **OAuth** — user completes Primus zkTLS verification in a new tab. Primus generates
   a cryptographic proof that the data is authentic without revealing the raw data.
4. **Callback** — frontend calls `POST /callback` with `taskId` + `verificationId`.
   Backend fetches the proof from Primus, verifies it, computes `dataHash`, and issues
   an on-chain attestation via the Circle wallet.
5. **Status** — frontend polls `GET /status/:id` until `state === "complete"`.

## Security

- **Auth:** all mutating endpoints require `requireSignedNonce` (signed message +
  one-time nonce).
- **Rate limiting:** write endpoints (`/start`, `/callback`) limited to 10 req/min
  per address. Global rate limit of 100 req/min applies to all routes.
- **Wallet ownership:** `subject` derived from `req.verifiedAddress` — never from
  request body.
- **No PII on-chain:** only `dataHash` (keccak256 commitment) is stored. Raw Web2 data
  stays with the user / Primus.
- **Error sanitization:** internal errors return generic messages; stack traces go to
  logs only.
- **JSONL advisory:** the JSONL store is never authoritative. On-chain `isValid()` is
  checked before trusting cached claims.

## Environment Variables

```bash
# Primus Labs API
PRIMUS_API_KEY=           # API key from Primus dashboard
PRIMUS_API_SECRET=        # HMAC signing secret
PRIMUS_API_BASE_URL=https://api.primuslabs.xyz
PRIMUS_REDIRECT_URI=      # OAuth redirect URL (e.g., https://arcpass.app/web2-proof)

# Circle issuer wallet for web2-proof attestations
CIRCLE_WEB2_PROOF_ISSUER_WALLET_ID=

# On-chain gate (deployed with Web2DataGate.sol)
WEB2_DATA_GATE_ADDRESS=
```

## Test Coverage

**Contracts (6 tests):**
- `Web2DataGate.t.sol` — true/false after issue/expire/revoke, ignores other schemas,
  reverts when no claim

**Backend (7 + 6 tests):**
- `primusService.test.ts` — full flow, idempotent re-verify, one-proof-per-provider
  cross-wallet rejection, same-subject re-verify, provider error handling, task ID
  mismatch, wrong wallet rejection
- `web2-proof.test.ts` — config endpoint, address validation, missing auth, status
  endpoint

**Schema parity:** `SchemaIdParity.t.sol` verifies `WEB2_DATA_PROOF` schema ID matches
on-chain and off-chain computation.

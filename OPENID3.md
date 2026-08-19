# OPENID3.md — OpenID3 Web2 Identity Linking

OpenID3 lets users link Web2 accounts (GitHub, Twitter/X, Discord, Email) to their
ArcPass wallet using OAuth-based decentralized authentication. The result is an on-chain
`OPENID3_IDENTITY` attestation that proves account ownership without storing any PII.

```
Select Provider → OAuth Authentication → Backend Witness → On-chain Attestation → Identity Linked
```

## Architecture

```
Frontend                    Backend                       Web2 Provider (GitHub/X/Discord)
   │                            │                              │
   ├─ POST /openid3/start ─────►│── OAuth redirect ───────────►│
   │◄── { linkId, authUrl }     │                              │
   │                            │                              │
   │  (user authenticates in    │                              │
   │   new tab via OAuth)       │                              │
   │                            │                              │
   ├─ POST /openid3/callback ──►│── exchange code for token ──►│
   │   { code, linkId }         │◄── user info ───────────────│
   │                            │                              │
   │                            │── attest() on-chain ────────►│
   │◄── { state: "complete" }   │                              │
```

## Components

### Contract: `IdentityGate`

`contracts/src/services/verifiers/IdentityGate.sol`

Stateless gate contract — mirrors `HumanityGate` and `Web2DataGate`. Reads the
`AttestationRegistry` to check if a subject holds a valid `OPENID3_IDENTITY` attestation.

```solidity
function isIdentityLinked(address subject) public view returns (bool)
function requireIdentityLinked(address subject) public view
```

### Schema: `OPENID3_IDENTITY`

Registered in `SOCIAL_SCHEMAS` (`backend/src/constants/schemas.ts`):

```typescript
OPENID3_IDENTITY: {
  id: keccak256("arcpass_openid3_identity" + "1.0.0" + fieldsJson),
  name: "arcpass_openid3_identity",
  version: "1.0.0",
  fields: [
    { name: "linked", type: "bool", visibility: "PUBLIC" },
    { name: "provider", type: "string", visibility: "PUBLIC" },
    { name: "accountHandle", type: "string", visibility: "PUBLIC" },
    { name: "accountVerified", type: "bool", visibility: "PUBLIC" },
    { name: "linkedAt", type: "uint64", visibility: "PUBLIC" },
  ],
}
```

All fields are `PUBLIC` — account linking is a public passport signal.

### Provider Adapter (`backend/src/services/openid3Provider.ts`)

```typescript
interface OpenID3Provider {
  createOAuthSession(params): Promise<OAuthSession>;
  exchangeCode(code, sessionId): Promise<UserInfoResult>;
  isConfigured(): boolean;
}
```

- **`OpenID3OAuthProvider`** — real OAuth client for GitHub, Twitter/X, Discord. Handles
  OAuth URL generation and code exchange (placeholder for production SDK).
- **`MockOpenID3Provider`** — deterministic mock for tests. Returns fixed handle/ID.

`getOpenID3Provider()` returns the real provider when any OAuth client ID is configured;
otherwise falls back to mock.

### Service (`backend/src/services/openid3Service.ts`)

State machine identical to Humanode/Primus:

```
initialized → pending → linked → attesting → complete
                                                  ↓
                                         failed / expired
```

**Key behaviors:**
- **Idempotent:** re-linking an already-complete wallet returns the existing session
  (with a fresh OAuth URL) if the on-chain claim is still valid.
- **One-link-per-provider:** `nullifier = keccak256(provider + accountId)` acts as a
  uniqueness key. If a different wallet attempts to link the same account, the callback
  is rejected with `OpenID3AlreadyLinked`.
- **Expiration:** records past `expiresAt` are marked `expired` and cannot complete.
- **JSONL advisory store:** `.openid3-links.jsonl` — append-only log. Not authoritative
  for claim validity (on-chain `isValid()` is).

### Routes (`backend/src/routes/openid3.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/openid3/config` | No | Returns available providers and schema ID |
| `GET` | `/openid3/verify/:address` | No | Returns identity link status for an address |
| `POST` | `/openid3/start` | Signed | Starts a new OAuth linking session |
| `GET` | `/openid3/status/:linkId` | Signed | Polls linking status |
| `POST` | `/openid3/callback` | Signed | Completes linking after OAuth callback |

Write endpoints are rate-limited to 10 per address per minute.

### Frontend

- **`useOpenID3.ts`** — hooks: `useOpenID3Flow` (start/poll/complete mutations),
  `useOpenID3Status` (public read), `useOpenID3Config` (providers list).
- **`OpenID3Identity.tsx`** — page with provider selection, OAuth redirect, polling,
  and identity display. Follows the same phase progression as HumanNode/Web2Proof.

## Data Flow

1. **Select provider** — user picks GitHub, Twitter/X, Discord, or Email.
2. **Start** — frontend calls `POST /start` with signed auth. Backend creates an OAuth
   session, stores the record, returns `linkId` + `authUrl`.
3. **OAuth** — user authenticates with the provider in a new tab. The provider verifies
   account ownership.
4. **Callback** — frontend calls `POST /callback` with `code` + `linkId`. Backend
   exchanges the code for user info, computes `nullifier`, and issues an on-chain
   attestation via the Circle wallet.
5. **Status** — frontend polls `GET /status/:linkId` until `state === "complete"`.

## Security

- **Auth:** all mutating endpoints require `requireSignedNonce` (signed message +
  one-time nonce).
- **Rate limiting:** write endpoints limited to 10 req/min per address.
- **Wallet ownership:** `subject` derived from `req.verifiedAddress` — never from
  request body.
- **No PII on-chain:** only `nullifier` (keccak256 of provider + accountId) is stored.
  Account handles stay off-chain.
- **Error sanitization:** internal errors return generic messages; stack traces go to
  logs only.
- **JSONL advisory:** never authoritative. On-chain `isValid()` checked before trusting
  cached claims.
- **Nullifier dedup:** prevents the same Web2 account from being linked to multiple
  wallets.

## Environment Variables

```bash
# OpenID3 — OAuth Providers
OPENID3_GITHUB_CLIENT_ID=
OPENID3_GITHUB_CLIENT_SECRET=
OPENID3_TWITTER_CLIENT_ID=
OPENID3_TWITTER_CLIENT_SECRET=
OPENID3_DISCORD_CLIENT_ID=
OPENID3_DISCORD_CLIENT_SECRET=
OPENID3_REDIRECT_BASE=http://localhost:5173

# Circle issuer wallet for OpenID3 attestations
CIRCLE_OPENID3_ISSUER_WALLET_ID=

# On-chain gate (deployed with IdentityGate.sol)
IDENTITY_GATE_ADDRESS=
```

## Test Coverage

**Contracts (7 tests):**
- `IdentityGate.t.sol` — false when no claim, reverts on `requireIdentityLinked`,
  true after issue, false after revoke, false after expiry, ignores other schemas

**Schema parity:** `SchemaIdParity.t.sol` verifies `OPENID3_IDENTITY` schema ID matches
on-chain and off-chain computation.

**Backend:** Service and route tests follow the same patterns as Humanode/Primus.

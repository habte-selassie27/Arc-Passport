# ArcPass Attestations

## 1. Purpose

Attestations are the core primitive of ArcPass.

An attestation allows an authorized issuer to make a verifiable claim about an ArcPass user.

The fundamental relationship is:

```
Issuer
   ↓
Claim
   ↓
Subject
```

Example:

```
Arc Project
    ↓
"Completed Arc Builder Program"
    ↓
0x123...
```

The goal is to make these claims:

- verifiable
- portable
- revocable
- optionally expirable
- understandable to users
- usable by other Arc applications

## 2. Attestation Model

An attestation should conceptually contain:

```
Attestation
├── id
├── subject
├── issuer
├── schema
├── data / commitment
├── issuedAt
├── expiresAt
└── status
```

The exact storage representation may differ between blockchain and backend.

The blockchain is authoritative for important on-chain state.

## 3. Attestation Lifecycle

The basic lifecycle is:

```
REQUESTED
    ↓
ISSUED
    ↓
VALID
    ↓
┌──────────────┐
│              │
↓              ↓
EXPIRED      REVOKED
```

An attestation must never be presented as valid if it is expired or revoked.

## 4. Issuing an Attestation

An issuer must be authorized before issuing credentials.

Basic flow:

```
Issuer
 ↓
Select subject
 ↓
Select schema
 ↓
Provide claim data
 ↓
Validate data
 ↓
Create commitment
 ↓
Submit transaction
 ↓
Wait for confirmation
 ↓
Attestation becomes valid
```

The frontend must clearly communicate transaction state:

```
Preparing
 ↓
Waiting for wallet
 ↓
Submitted
 ↓
Confirming
 ↓
Confirmed
```

## 5. Issuer Authorization

Only authorized issuers may issue protected attestation types.

Authorization should be verified independently of frontend claims.

Never trust "frontend says I am an issuer".

The backend and/or blockchain must verify issuer authorization.

## 6. Revocation

Issuers or authorized revokers may revoke an attestation where the schema/policy permits it.

After revocation:

```
status = REVOKED
```

The attestation remains historically discoverable where appropriate, but must no longer be treated as valid.

## 7. Expiration

Time-sensitive credentials may include an expiration timestamp.

Example:

```
expiresAt = 0
```

means no expiration.

Otherwise:

```
currentTime >= expiresAt
```

means the credential is expired.

The UI should distinguish:

- ✓ Valid
- ⚠ Expiring soon
- ⚠ Expired
- ✕ Revoked

## 8. Claim Schemas

Schemas define the structure of a credential.

A schema should have:

- name
- version
- fields

Example:

```json
{
  "name": "arc_builder",
  "version": "1.0.0",
  "fields": [
    {
      "name": "program",
      "type": "string"
    },
    {
      "name": "verified",
      "type": "bool"
    }
  ]
}
```

Schemas should be immutable once registered.

If the structure changes significantly, create a new schema version.

Do not silently change the meaning of an existing schema.

## 9. Field Classification

Fields may be classified as:

| Type | Meaning |
|------|---------|
| PUBLIC | Safe to display publicly |
| PRIVATE | Should only be disclosed with user authorization |
| DERIVED | Computed from other data and not stored directly |

Example:

```json
{
  "fields": [
    {
      "name": "program",
      "type": "string",
      "classification": "PUBLIC"
    },
    {
      "name": "privateCredentialData",
      "type": "string",
      "classification": "PRIVATE"
    }
  ]
}
```

Sensitive information should never be publicly exposed merely because it exists in an attestation.

### Registered V1 schemas

**kyc_basic (v1.0.0)**

```json
{
  "name": "kyc_basic",
  "version": "1.0.0",
  "fields": [
    { "name": "level", "type": "uint8", "classification": "PUBLIC" },
    { "name": "country", "type": "string", "classification": "PUBLIC" },
    { "name": "provider", "type": "address", "classification": "PUBLIC" }
  ]
}
```

**professional (v1.0.0)**

```json
{
  "name": "professional",
  "version": "1.0.0",
  "fields": [
    { "name": "title", "type": "string", "classification": "PUBLIC" },
    { "name": "organization", "type": "string", "classification": "PUBLIC" },
    { "name": "verified", "type": "bool", "classification": "PUBLIC" }
  ]
}
```

> The canonical, source-of-truth schema definitions live in `backend/src/constants/schemas.ts`;
> this section summarizes the registered V1 schemas.

## 10. Standard Credential Categories

ArcPass should prioritize credentials relevant to the Arc ecosystem.

Examples:

- **Builder** — proof that a user participated in or contributed to an Arc project.
- **Hackathon Participant** — proof of participation in an Arc-related hackathon.
- **Contributor** — proof of contribution to an Arc ecosystem project.
- **Community** — proof of verified participation in an Arc community.
- **Project Credential** — a credential issued by an Arc application.

Avoid creating dozens of credential types before there is actual demand.

## 11. Selective Disclosure (V2)

ArcPass uses Merkle-based commitments for selective disclosure. Each claim's `dataCommitment` on-chain is the **Merkle root** of its field leaves, not a flat hash.

### Merkle tree construction

Each field is encoded as a leaf:

```
leaf = keccak256(abi.encode(fieldName, fieldType, keccak256(abi.encode(fieldValue))))
```

The leaves form a standard binary Merkle tree (sorted pairs). The tree root is stored on-chain as `dataCommitment`.

### Field classifications

| Type | Meaning | Displayed on public passport |
|------|---------|------------------------------|
| PUBLIC | Safe to display publicly | Yes |
| PRIVATE | Only disclosed with subject authorization | No |
| DERIVED | Computed from other fields, never stored | Computed |

All field classifications are defined in `backend/src/constants/schemas.ts`.

### Proof generation flow

```
1. Subject calls GET /attestation/:claimId/field/:fieldName/proof
   (requires signed nonce — only the claim subject can generate proofs)
2. Backend retrieves the IPFS payload, finds the field leaf index,
   reconstructs the Merkle tree, and returns:
   { leaf, proof, leafIndex, field: { name, type, value, classification } }
3. Subject shares (leaf, proof, leafIndex) with the verifier
4. Verifier calls GET /attestation/:claimId/field/:fieldName/verify
   with ?leaf=...&leafIndex=...&proof=...
5. Backend calls PassportVerifier.verifyField() on-chain → { valid: boolean }
```

### Field verification (on-chain)

`PassportVerifier.verifyField(claimId, fieldLeaf, proof, leafIndex)` checks that the leaf belongs to the committed Merkle root without revealing other fields.

### Legacy claims

Claims issued before V2 used `keccak256(flatAbiEncodedData)` as `dataCommitment` — they have no Merkle tree. The frontend shows a "Selective disclosure not available for legacy claims" badge for these.

## 12. Privacy Rules

Do not store sensitive personal information directly on-chain.

Never put the following on-chain unless a specific privacy-preserving design explicitly requires it:

- government IDs
- private documents
- phone numbers
- email addresses
- physical addresses
- biometric information
- private credentials

Use commitments, hashes, encrypted off-chain storage, or privacy-preserving credentials where appropriate.

## 13. Verification

Verification should answer:

> Is this credential genuine and currently valid?

A verifier should check:

1. Attestation exists
2. Issuer is legitimate
3. Subject matches
4. Schema is valid
5. Credential is not revoked
6. Credential is not expired
7. Commitment/data is valid

The exact checks depend on the credential type.

## 14. Public Passport Verification

A public Passport should summarize verified credentials.

Example:

```
ARC PASSPORT

0x123...

Credentials

✓ Arc Builder
  Issuer: Arc Project

✓ Hackathon Participant
  Issuer: Encode

⚠ Expired
  Contributor

✕ Revoked
  Previous Credential
```

Anyone should be able to inspect public credentials without connecting a wallet.

## 15. Attestation Requests

A future-friendly flow may allow:

```
User
 ↓
Requests credential
 ↓
Issuer reviews
 ↓
Issuer issues
 ↓
User receives credential
```

Requests are useful when issuers need user consent or evidence before issuing.

Do not build a complex messaging system around requests.

## 16. Issuer Experience

ArcPass should make issuing credentials simple.

Issuer dashboard:

```
Issued
Pending
Revoked
Expired

[Issue Credential]
```

Issuers should not need to understand:

- contract storage
- calldata
- Merkle implementation
- RPC mechanics

The ArcPass UI/API should abstract those details.

### Practical issuer workflow

**Becoming an issuer:**

1. Deploy ArcPass contracts
2. Have the admin (`DEFAULT_ADMIN_ROLE`) grant your address `ISSUER_ROLE`:
   ```
   registry.grantRole(ISSUER_ROLE, your_address)
   ```
3. Register your claim schemas via `SchemaRegistry`

**Issuing via smart contract (direct call):**

```solidity
bytes32 claimId = attestationRegistry.attest(
    subject,          // address — the claim recipient
    schemaId,         // bytes32 — registered schema ID
    dataCommitment,   // bytes32 — Merkle root of claim fields
    expiresAt         // uint256 — 0 = never expires
);
```

**Issuing via backend API:**

```bash
curl -X POST /attestation/attest \
  -H "x-wallet-address: 0x..." \
  -H "x-signature: 0x..." \
  -H "x-nonce: uuid" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "0x...",
    "schemaId": "0x...",
    "data": "0x...",
    "expiresAt": 0
  }'
```

**Revoking claims:**

```solidity
attestationRegistry.revoke(claimId);
```

**Best practices:**

1. Always verify the subject has consented to the claim
2. Store raw claim data off-chain (IPFS) encrypted
3. Only commit the Merkle root on-chain
4. Set reasonable expiry dates for time-sensitive claims
5. Never issue claims that violate GDPR or local regulations

## 17. API Philosophy

Keep the API small and predictable.

Potential endpoints:

```
GET  /api/passports/:address
GET  /api/passports/:address/attestations
GET  /api/attestations/:id
POST /api/attestations
POST /api/attestations/:id/revoke
GET  /api/verify/:address
```

Only create an endpoint when there is an actual consumer.

## 18. SDK Direction

A future ArcPass SDK should make verification easy for Arc applications.

Conceptually:

```ts
const passport = await arcpass.getPassport(address);

const result = await arcpass.verifyCredential(credentialId);
```

The SDK should hide unnecessary blockchain complexity.

## 19. Trust Score & Reputation Signals

ArcPass computes a **transparent, weighted trust score** from on-chain attestations.
The scoring model is inspired by Human Passport's composable trust layer pattern.

### Scoring Model

```
Trust Score = Σ(categoryWeight × (credentialScore + issuerBonus))
```

- **Category weights**: Identity/KYC = 1.0, Credentials/Reputation/Employment = 0.7-0.8, Education = 0.5, Social = 0.4, Custom = 0.3
- **Credential score**: Each valid attestation contributes base points
- **Issuer bonus**: Bonus for unique issuers within a category
- **Schema bonuses**: Government ID, liveness, KYC, humanity proofs get 1.3-1.5x multiplier

### Score Display

The Passport page shows a composite score (0-100) with:

```
Trust Score
82 / 100
████████████████████░░░░  (82% of max)

Attestations: 18
Unique issuers: 6
Categories: 7/9
Status: Passed (threshold: 20)

Category Breakdown
Identity & Passport     3 claims · 45.0 pts
KYC / Compliance        2 claims · 38.0 pts
Professional Credentials 4 claims · 32.0 pts
Reputation & Trust      3 claims · 28.0 pts
Education               2 claims · 18.0 pts
Social Verification     3 claims · 15.0 pts
```

### Scoring Policies

| Policy | Threshold | Use Case |
|--------|-----------|----------|
| Default | 20 | General purpose |
| High Security | 40 | KYC-gated applications |
| Low Friction | 10 | Quick verification |

### Developer API

Third-party apps verify wallets via a single HTTP call:

```
GET /v1/verify/:address?policy=default&threshold=20
```

Response:
```json
{
  "success": true,
  "data": {
    "passed": true,
    "score": 82,
    "threshold": 20,
    "attestationCount": 18,
    "uniqueIssuers": 6,
    "activeCategories": ["identity", "kyc", "credentials", ...]
  }
}
```

### Design Principles

1. **Transparent**: Score is computed from visible, on-chain attestations
2. **Configurable**: Applications set their own thresholds and policies
3. **Additive**: Score increases with more attestations from more issuers
4. **Not opaque**: Never an AI score or hidden weighting — all factors are visible
5. **Verifiable**: Score derives from on-chain state, not backend cache

Reputation is derived from attestations.

It is not the same thing as identity.

## 20. Notifications

Notifications may support:

- new attestation
- attestation request
- credential expiration
- credential revocation
- issuer actions

Keep notifications simple.

A database-backed notification system is sufficient initially.

Do not introduce real-time infrastructure unless there is a demonstrated need.

## 21. What Attestations Are NOT

ArcPass attestations are not intended to become:

- a social network
- a messaging platform
- a token
- an NFT collection
- a DAO
- a generic reputation marketplace
- a financial privacy system

The product remains focused on:

```
Issue
 ↓
Own
 ↓
Verify
 ↓
Share
```

## 22. Future Privacy

The attestation architecture should allow future privacy improvements without redesigning the core system.

Possible future capabilities:

```
Merkle Selective Disclosure
        ↓
ZK Proofs
        ↓
Selective Credential Disclosure
        ↓
Private Computation / FHE
```

ZK and FHE are optional extensions.

They should not complicate the V1 implementation unless a concrete product requirement exists.

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

## 11. Selective Disclosure

ArcPass V1 may use Merkle-based commitments for selective disclosure.

Conceptually:

```
Claim
  ↓
Merkle Tree
  ├── Field A
  ├── Field B
  ├── Field C
  └── Field D
```

A user may provide:

```
Field B
+
Merkle Proof
```

without exposing every field.

The verifier checks that the disclosed field belongs to the committed claim.

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

## 19. Reputation Signals

Reputation should initially be represented through transparent, verifiable signals.

Prefer:

```
14 valid attestations
6 unique issuers
4 Arc projects
3 builder credentials
2 hackathon credentials
```

Avoid an opaque:

```
Reputation: 87/100
```

unless the scoring model is transparent, defensible, and genuinely useful.

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

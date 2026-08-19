# ZKPassport — Feature Reference

## Purpose

ZKPassport is a privacy-preserving identity verification system that uses cryptographically signed NFC-enabled government IDs/ePassports as the trust anchor.

Its key model is:

```text
Government ID
    ↓
NFC chip
    ↓
Cryptographic signature verification
    ↓
On-device ZK proof
    ↓
Selective disclosure
    ↓
Verifier
```

The passport data remains on the user's device while the relying application receives a cryptographic proof.

## Core Features

### 1. NFC Passport / ID Reading

Users scan the NFC chip of supported government IDs.

ZKPassport states that it supports NFC-based identity verification across 130+ countries.

### 2. Cryptographic Document Authenticity

Instead of trusting an uploaded passport image, ZKPassport verifies the digital signature from the passport's chip against the issuing country's certificate infrastructure.

This makes the trust anchor the issuing authority's cryptography rather than visual document inspection.

### 3. On-Device Processing

Sensitive operations occur on the user's device:

- NFC reading
- Signature verification
- Proof generation

The relying party receives the proof rather than the raw passport information.

### 4. Zero-Knowledge Proofs

ZKPassport generates cryptographic proofs that allow a verifier to confirm identity attributes without receiving the underlying identity data.

Examples:

```text
age >= 18
```

without revealing:

```text
exact date of birth
```

or:

```text
nationality = X
```

without revealing the user's full identity document.

### 5. Selective Disclosure

The verifier can request only the attributes it needs.

Possible requests:

```text
✓ Is the user over 18?
✓ Is the passport valid?
✓ Is the user a citizen of a specified country?
✓ Is the document issued by a trusted authority?
```

This follows the principle:

> Verify what you need, not everything the document contains.

ZKPassport explicitly positions its SDK around requesting and verifying specific identity attributes.

### 6. Optional Liveness

An optional liveness check can verify that the person holding the phone is the actual ID owner.

### 7. Dual-Layer Proof Model

The zkMe documentation for the same zkPassport concept describes two proof layers:

```text
Layer 1
Passport authenticity
        ↓
"Valid government-issued passport"

Layer 2
Attribute proof
        ↓
"Age >= 18"
"Nationality = X"
```

This separation is useful because document authenticity and derived claims are different security properties.

### 8. SDK

ZKPassport provides a TypeScript SDK for applications.

A verifier can configure:

- Application name
- Logo
- Purpose
- Requested identity attributes

and receive verification results.

### 9. Fast Verification

The generated proof can be verified through the SDK and can also be verified on-chain. ZKPassport states that verification can be performed in milliseconds.

### 10. Privacy by Cryptography

The security model is stronger than simply promising not to store identity information.

The desired flow is:

```text
Raw passport data
      │
      ▼
User device
      │
      ├── Verify authenticity
      │
      └── Generate ZK proof
                 │
                 ▼
              Network
                 │
                 ▼
             Verifier
```

The verifier does not need the original passport data.

## Main Architecture

```text
             GOVERNMENT
                 │
          Signed ePassport
                 │
                 ▼
              USER
                 │
              NFC scan
                 │
                 ▼
        ┌─────────────────┐
        │   USER DEVICE   │
        │                 │
        │ NFC reader      │
        │ PKI validation  │
        │ ZK generation   │
        │ Liveness        │
        └────────┬────────┘
                 │
             ZK Proof
                 │
                 ▼
           ┌────────────┐
           │  VERIFIER  │
           └─────┬──────┘
                 │
        ┌────────┴─────────┐
        ▼                  ▼
   Application          On-chain
   verification        verification
```

## Features Worth Learning for ArcPass

### Highest Priority

- Government-issued credential as a trust anchor
- NFC verification
- Cryptographic authenticity
- On-device processing
- Selective disclosure
- ZK attribute proofs
- Optional liveness
- SDK-based verifier integration
- On-chain proof verification
- Clear privacy boundaries

## ArcPass Design Lesson

ArcPass should not require users to place full identity information into a centralized database.

A better model is:

```text
Identity Source
      ↓
Verified Credential
      ↓
ArcPass Attestation
      ↓
ZK Proof
      ↓
Selective Disclosure
      ↓
Verifier
```

Example:

```text
Verifier asks:

"Is this user over 18?"

ArcPass returns:

✓ Valid proof
✓ Issuer trusted
✓ Credential valid
✓ Age >= 18

Does NOT return:

Name
DOB
Passport number
Address
Document image
```

## Important Security Considerations

If ArcPass implements this type of flow, pay attention to:

- Government PKI trust anchors
- Certificate revocation
- Passport expiry
- Document authenticity
- Proof freshness
- Replay protection
- Nullifier/linkability design
- Liveness
- Device compromise
- Wallet binding
- Country-specific document differences
- Key rotation
- Trusted issuer configuration

## Main Product Lesson

ZKPassport demonstrates that **identity verification and identity disclosure should be separate operations**.

ArcPass should aim to prove:

```text
"This claim is true"
```

without automatically revealing:

```text
"Here is all the information that made the claim true."
```

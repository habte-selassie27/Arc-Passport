# Ethereum Attestation Service (EAS) — Feature Reference

## Purpose

EAS is a generalized attestation infrastructure for creating, storing, querying, and verifying structured claims. Its core model separates a **schema** (the structure of a claim) from an **attestation** (the signed claim using that schema).

## Core Features

### 1. Schema Registry

Schemas define the fields and Solidity ABI types used by attestations.

A schema contains:

- Schema UID
- Schema definition
- Creator
- Resolver address
- Revocability configuration
- Registration transaction

Schemas are registered on-chain through the Schema Registry contract.

Example:

```text
IdentityVerification
├── verificationLevel: uint8
├── country: string
├── verifiedAt: uint64
└── expiresAt: uint64
```

### 2. On-Chain Attestations

An attester can create a structured attestation against a registered schema.

An attestation includes concepts such as:

- UID
- Schema UID
- Attester
- Recipient
- Creation time
- Expiration time
- Revocability
- Revocation time
- Reference UID
- Encoded data

EAS stores the attestation on-chain and makes it independently verifiable.

### 3. Off-Chain Attestations

EAS supports signed off-chain attestations.

This allows applications to obtain the benefits of structured, cryptographically signed attestations without necessarily paying to store every attestation on-chain.

The SDK includes creation and signature-verification support for off-chain attestations.

### 4. Delegated Attestations

EAS supports delegated on-chain attestations where one party signs an attestation request and another account submits/pays for the transaction.

This is useful for:

- Gas abstraction
- Backend relayers
- Issuer infrastructure
- Sponsored transactions

The SDK supports delegated attestation creation and revocation.

### 5. Revocation

Revocable schemas can have attestations revoked.

Applications can therefore distinguish:

```text
Valid
Expired
Revoked
Invalid
```

Revocation is part of the attestation lifecycle and should be checked by verifiers.

### 6. Expiration

Attestations can contain an expiration timestamp.

This enables credentials such as:

- KYC valid for one year
- Employment valid until a date
- Certification valid until a date
- Membership valid until a date

### 7. Referenced Attestations

Attestations can reference other attestations using `refUID`.

This enables composable claims.

Example:

```text
University
   ↓
Degree Attestation
   ↓
Employment Attestation
   ↓
Professional Reputation Attestation
```

Rather than duplicating information, attestations can build relationships between claims.

### 8. Resolver Contracts

A schema can optionally specify a resolver contract.

Resolvers can enforce custom business rules before an attestation or revocation succeeds.

Examples include:

- Only an approved issuer can attest
- Recipient must match a specific address
- Payment must accompany an attestation
- Custom validation rules
- Triggering additional contract logic

Resolvers are an important extension point for application-specific security and logic.

### 9. Schema Modularity

EAS encourages small, composable schemas rather than huge schemas containing every possible field.

For ArcPass this suggests:

```text
KYC Schema
+
Education Schema
+
Employment Schema
+
Reputation Schema
=
User Credential Graph
```

rather than one giant identity schema.

### 10. SDK

The EAS SDK provides functionality for:

- Registering schemas
- Reading schemas
- Creating attestations
- Creating multiple attestations
- Revoking attestations
- Creating off-chain attestations
- Creating delegated attestations
- Verifying off-chain signatures
- Reading attestation data
- Private-data/Merkle-proof functionality

### 11. Explorer / GraphQL Indexing

EAS ecosystem tooling provides indexed schema and attestation data.

EASSCAN exposes GraphQL APIs that allow applications to query:

- Attestations
- Schemas
- Attesters
- Recipients
- Expiration
- Revocation
- Reference UIDs
- Raw encoded data

### 12. Private Data / Merkle Proofs

The SDK also contains private-data functionality using Merkle trees and proofs.

This is useful when applications need to prove inclusion of selected data without necessarily exposing an entire dataset.

## Core Architecture

```text
                 SCHEMA CREATOR
                       │
                       ▼
               Schema Registry
                       │
                  Schema UID
                       │
                       ▼
                 ATTESTER
                       │
              ┌────────┴────────┐
              │                 │
        On-chain             Off-chain
        Attestation          Attestation
              │                 │
              └────────┬────────┘
                       ▼
                 Attestation
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
     Resolver       Indexer       Verifier
        │              │              │
        ▼              ▼              ▼
    Rules/Logic      Search       Valid/Invalid
```

## Features Worth Learning for ArcPass

### Highest Priority

- Schema registry
- Schema UID
- Attestation UID
- On-chain attestations
- Off-chain attestations
- Delegated attestations
- Revocation
- Expiration
- Referenced attestations
- Resolver contracts
- Indexed querying
- SDK abstraction

### ArcPass Design Lesson

Do not make the ArcPass credential itself the entire system.

Use layers:

```text
Schema
   ↓
Attestation
   ↓
Credential
   ↓
Passport
   ↓
ZK Proof
   ↓
Verification
```

The attestation layer should provide durable claims, while the Passport layer aggregates claims and the ZK layer provides selective disclosure.

## Example ArcPass Schema

```text
EmploymentCredential

subject: address
employer: bytes32
role: string
verifiedAt: uint64
expiresAt: uint64
```

Then:

```text
Issuer
  ↓
Register Schema
  ↓
Issue Attestation
  ↓
Store UID
  ↓
Passport indexes credential
  ↓
Holder generates selective proof
  ↓
Verifier checks proof
```

## Main Design Lesson

EAS's strongest architectural idea is **composability**.

An attestation should be a small, reusable, independently verifiable claim rather than a complete identity profile.

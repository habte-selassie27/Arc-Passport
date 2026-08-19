# zkPass — Feature Reference

## Purpose

zkPass is a privacy-preserving data verification protocol designed to turn private information available through HTTPS websites into verifiable proofs.

Its core concept is:

```text
Private Web2 Data
      ↓
HTTPS / TLS
      ↓
3P-TLS + MPC
      ↓
Zero-Knowledge Proof
      ↓
Selective Claim
      ↓
Web3 Application
```

zkPass describes this as a bridge between private Web2 data and verifiable Web3 data.

## Core Features

### 1. zkTLS

zkPass extends TLS into a three-party model so that information originating from an HTTPS website can be cryptographically proven without revealing the underlying private data.

The goal is to prove:

```text
"The website says X about this user"

without revealing:

"Everything the website knows about this user."
```

### 2. Three-Party TLS (3P-TLS)

The core parties are:

```text
Prover
   │
   ├──────────────┐
   │              │
   ▼              ▼
Data Source    Validator
(HTTPS site)   / Node
```

This helps establish data provenance and integrity while protecting the user's private information.

### 3. Hybrid ZK + MPC

zkPass combines:

- Three-party TLS
- Multi-party computation
- Interactive ZK
- Non-interactive ZK
- VOLE-based cryptographic techniques

Its current technical documentation describes Proxy Mode and MPC Mode as components of a Hybrid Mode.

### 4. Any HTTPS Website

A major feature is compatibility with HTTPS websites without requiring every website to expose a custom API.

This enables proof sources such as:

- Financial platforms
- Social networks
- Gaming platforms
- Education platforms
- Employment systems
- Healthcare platforms
- KYC providers

subject to the protocol's supported verification templates and technical constraints.

### 5. Selective Disclosure

Users prove only the requested condition.

Example:

```text
Source:
binance.com

Claim:
balance >= $10,000

Proof:
VALID

Revealed:
None
```

The raw account balance does not need to be disclosed. zkPass explicitly supports private and selective validation.

### 6. Schema / Template System

Developers configure schemas that define what information should be extracted and what assertions should be checked.

A schema can define conditions such as:

```text
age >= 18
country == "ET"
balance >= 10000
accountExists == true
employmentYears >= 3
```

The developer workflow includes creating a project, selecting a base schema, configuring assertions, and receiving a schema ID.

### 7. TransGate

TransGate is the user-facing component.

It is available through:

- Browser extension
- Android app
- iOS app/Clip

It handles the private interaction with the Web2 source and connects the result back to the DApp.

### 8. Developer SDK

The JS SDK allows DApps to integrate TransGate.

Important functionality includes:

```text
isTransgateAvailable()
launch(schemaId, address)
```

The result can include:

- Allocator address
- Allocator signature
- Public fields
- Public-field hash
- Task ID
- User hash
- Validator address
- Validator signature
- Recipient address

### 9. Allocator Nodes

Allocator nodes generate verification task metadata and select validators.

They sign task metadata before returning it to the user/application.

### 10. Validator Nodes

Validator nodes participate in verification, validate the proof/data flow, and return signed verification results.

This adds a decentralized verification layer rather than relying on a single backend server.

### 11. Anti-Cheating

zkPass uses predefined templates and cryptographic checks to prevent users from manipulating:

- Client requests
- Server responses
- Extracted values
- Verification conditions

The goal is that a user cannot simply claim:

```text
balance >= $10,000
```

unless the authenticated source actually supports the statement.

### 12. Local Proof Generation

zkPass describes local proof generation using VOLE-based techniques.

Its documentation emphasizes memory-efficient proof generation in the browser/device.

### 13. On-Chain Attestations

Verified results can be transformed into on-chain identity objects such as zkSBTs or otherwise stored/used by applications.

The SDK documentation explicitly describes the option to transform verification results into an on-chain identity or store them off-chain.

### 14. Portable Proofs / Collections

The current zkPass product also presents:

- Account profiles
- Proof collections
- Portable proofs
- Browser-based proof generation
- Agent-oriented verification

The current product direction exposes the same underlying proof primitive through both a human-facing browser extension and developer/agent tooling.

### 15. Agent Integration

The current zkPass product introduces an SDK-oriented interface for autonomous agents, including:

```text
verify()
verifyCampaign()
chat()
```

This allows agents to request or validate private-data proofs programmatically.

## Main Architecture

```text
                HTTPS WEBSITE
                     │
                     │ Private data
                     ▼
                  PROVER
                     │
              TransGate
                     │
            ┌────────┴────────┐
            │                 │
       Allocator          Validator
            │                 │
            └────────┬────────┘
                     │
                  3P-TLS
                     │
                MPC + ZK
                     │
                     ▼
                ZK PROOF
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
       DApp                  On-chain
                              Identity
```

## Example ArcPass Integration

Imagine ArcPass wants to verify employment without requiring users to upload documents.

```text
User logs into LinkedIn / HR platform
              ↓
        zkPass TransGate
              ↓
     Verify HTTPS response
              ↓
      Generate ZK proof
              ↓
"Employment = verified"
"Experience >= 3 years"
              ↓
          ArcPass
              ↓
     Issue attestation
              ↓
       ArcPass Passport
              ↓
    User generates ZK proof
              ↓
          Verifier
```

## Features Worth Learning for ArcPass

### Highest Priority

- Web2 → Web3 proof bridge
- zkTLS
- 3P-TLS
- Selective disclosure
- Assertion/schema system
- Local proof generation
- Anti-cheating mechanisms
- Decentralized validator architecture
- SDK integration
- On-chain credential conversion
- Portable proof collections

## ArcPass Design Lesson

ArcPass does not need to become a Web2 proof protocol itself.

Instead, it can consume specialized proofs from systems such as zkPass:

```text
                zkPass
                   │
          "Employment verified"
                   │
                   ▼
             ArcPass Issuer
                   │
             Attestation
                   │
                   ▼
              Passport
                   │
             ZK selective
              disclosure
                   │
                   ▼
               Verifier
```

This gives ArcPass a clean separation of responsibilities:

```text
zkPass
  = Prove private Web2 data

ZKPassport
  = Prove government-ID claims

EAS-style layer
  = Store / register / verify attestations

ArcPass
  = Aggregate credentials + issuer management +
    passport + policies + verification
```

## Important Security Considerations

When integrating a zkPass-like system, verify:

- Proof signature
- Validator authenticity
- Schema ID
- Source domain
- Data freshness
- Recipient/wallet binding
- Replay protection
- Expiration
- Revocation
- Nullifier/linkability rules
- Template integrity
- Trust assumptions of validator nodes
- On-chain verification result

Never treat a frontend-produced "verified" boolean as a cryptographic proof.

## Main Product Lesson

zkPass demonstrates a powerful principle:

> **The source of truth can remain private while the truth of a specific claim becomes publicly verifiable.**

For ArcPass:

```text
Private source
     ↓
Cryptographic proof
     ↓
Verified claim
     ↓
ArcPass attestation
     ↓
Portable credential
     ↓
Selective ZK disclosure
```

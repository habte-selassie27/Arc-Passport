# Primus Labs — Feature Reference

## Overview

Primus Labs provides cryptographic infrastructure for verifying Web2/off-chain data and making that data usable by Web3 applications without requiring the original Web2 service to modify its infrastructure.

Its core technology is **zkTLS**, which allows applications to prove the authenticity of TLS-protected Web2 data while preserving the privacy of the underlying information.

Primus also provides infrastructure for privacy-preserving computation through zkFHE and related cryptographic computation systems.

---

# 1. zkTLS Data Verification

Primus's primary capability is proving that information obtained from a Web2 website or API is authentic.

The system can establish that:

* data came from the expected website
* the TLS-protected response was authentic
* the data was not modified by the user
* selected information can be proven without revealing the complete underlying data

This creates a bridge between:

`Web2 Data → Cryptographic Proof → Web3 Application`

---

# 2. Privacy-Preserving Web2 Proofs

Users can prove specific properties of their Web2 data without exposing the entire dataset.

Examples:

* prove an account exists
* prove a user has completed KYC
* prove an account has a specific balance
* prove a user has a particular reputation
* prove trading activity
* prove ownership of an off-chain asset
* prove eligibility for an application

The verifier receives cryptographic evidence rather than needing direct access to the user's private Web2 data.

---

# 3. Web2 → Web3 Data Bridge

Primus enables decentralized applications to consume information that normally exists outside blockchains.

Potential sources include:

* centralized exchanges
* social platforms
* financial services
* Web2 applications
* websites
* APIs
* account systems

This allows applications to build trust decisions using data that is not natively available on-chain.

---

# 4. Data Templates

Primus supports predefined **data templates** that describe how information should be extracted and verified from an off-chain data source.

A template can define:

* target website
* target endpoint
* relevant fields
* data extraction logic
* verification requirements
* expected response structure

Applications can reference templates rather than implementing every Web2 verification flow from scratch.

---

# 5. Developer SDK

Primus provides SDK-based integration for applications.

The SDK can be used to:

* create verification tasks
* select data templates
* communicate with attestors
* execute zkTLS verification
* generate attestations
* retrieve proof results
* submit proofs to applications

This allows developers to integrate data verification into existing dApps.

---

# 6. Attestor Network

Primus uses an attestor network to participate in verification.

Attestors:

* execute verification tasks
* participate in zkTLS protocols
* generate cryptographic attestations
* sign verification results
* provide verification services to applications

The network can therefore act as a decentralized verification layer between Web2 data and Web3 applications.

---

# 7. Attestor Nodes

Primus supports dedicated attestor nodes.

An attestor node can:

* register with the network
* receive verification tasks
* execute zkTLS verification
* produce attestations
* report verification results
* receive task fees

Production attestor deployments can use trusted execution environments.

---

# 8. Multiple zkTLS Modes

Primus supports different zkTLS approaches with different performance/security trade-offs.

## MPC Mode

The client and attestor collaboratively establish the TLS session.

Advantages:

* stronger protection against client-side manipulation
* cryptographic verification of TLS data
* privacy-preserving proof generation

Use when data integrity and resistance to client tampering are especially important.

## Proxy Mode

The attestor operates as an intermediary for the TLS connection.

Advantages:

* better performance
* reduced computational overhead
* suitable for higher-throughput applications

The trade-off is additional trust/network assumptions around the attestor's communication with the target server.

---

# 9. Attestation Generation

After successful verification, Primus can generate an attestation representing the verified information.

Conceptually:

`Web2 Source`

↓

`zkTLS Verification`

↓

`Attestor`

↓

`Cryptographic Attestation`

↓

`Application / Smart Contract`

The attestation can then be presented to another application for verification.

---

# 10. On-Chain Verification

Primus enables verified off-chain information to be consumed by blockchain applications.

Potential architecture:

`User`

→ `Primus SDK`

→ `Web2 Source`

→ `zkTLS`

→ `Attestor`

→ `Attestation`

→ `Smart Contract`

The contract can use the verification result for:

* access control
* rewards
* lending
* reputation
* eligibility
* governance
* token distribution

---

# 11. Proof of Off-Chain Assets

Primus can be used to prove ownership of assets held on centralized platforms.

Examples:

* CEX token balances
* exchange account assets
* trading positions
* historical trading activity

A user can prove a condition such as:

`CEX Balance >= 10,000 USDT`

without necessarily exposing the user's entire financial account.

---

# 12. KYC / Identity Verification

Primus can verify information from Web2 identity systems.

Possible applications:

* KYC verification
* account ownership
* identity attributes
* eligibility checks
* compliance-related claims

The important primitive is:

`Web2 Identity Evidence → Cryptographic Proof → Verifiable Claim`

---

# 13. Reputation Verification

Web2 reputation can become a verifiable credential.

Potential examples:

* social reputation
* platform activity
* trading history
* user level
* account age
* participation history

Applications can use these proofs for:

* Sybil resistance
* reputation systems
* access control
* rewards
* governance

---

# 14. Private Data Computation

Primus also explores privacy-preserving computation.

The broader architecture can combine:

`zkTLS`

*

`Private Data`

*

`zkVM / zkFHE`

to allow applications to verify or compute on private information without exposing the underlying data.

---

# 15. zkFHE

Primus's broader cryptographic infrastructure includes zkFHE capabilities.

Potential applications include:

* confidential voting
* private auctions
* encrypted computation
* privacy-preserving analytics
* confidential financial logic

The goal is to allow computation over protected information while retaining cryptographic verifiability.

---

# 16. Chain Agnostic Infrastructure

Primus is designed as a chain-agnostic verification layer.

The same verification infrastructure can potentially support applications deployed across different blockchains.

This makes the architecture suitable for multi-chain identity and reputation systems.

---

# 17. Browser / User-Driven Verification

Primus supports dApp integrations where users initiate verification themselves.

A typical flow:

1. User opens the dApp.
2. User starts verification.
3. Primus SDK creates a verification task.
4. User interacts with the target Web2 service.
5. zkTLS verification is executed.
6. Attestor generates the proof.
7. Application receives the attestation.
8. Application verifies the result.
9. Optional blockchain transaction records the result.

---

# 18. Backend Verification

Primus also provides backend-oriented integration.

This can be used when:

* the application manages the verification process
* credentials are available to the backend
* automated verification is required
* user interaction is not appropriate

Backend integrations must treat credentials and external account access as highly sensitive.

---

# 19. Use Cases

Primus-style infrastructure can support:

### Identity

* KYC proofs
* account ownership
* identity attributes

### DeFi

* proof of CEX assets
* creditworthiness
* trading history
* undercollateralized lending

### Governance

* verified participation
* reputation-based voting
* eligibility proofs

### Gaming

* token ownership
* account achievements
* Web2 reputation

### Airdrops

* eligibility verification
* anti-Sybil checks
* off-chain activity proofs

### AI

* verifiable Web2 data
* private data computation
* cryptographic data provenance

---

# 20. Features Relevant to ArcPass

For an identity/attestation protocol such as ArcPass, the most useful Primus-inspired capabilities are:

* Web2 account verification
* zkTLS proofs
* private attribute verification
* Web2 reputation proofs
* CEX asset proofs
* KYC status proofs
* attestor-based verification
* reusable attestations
* on-chain verification
* data templates
* selective disclosure
* privacy-preserving computation

---

# 21. Reference Architecture

```text
                    ┌────────────────────┐
                    │    Web2 Service    │
                    │ Website / API / CEX│
                    └─────────┬──────────┘
                              │
                              │ TLS Data
                              ▼
                    ┌────────────────────┐
                    │      zkTLS         │
                    │  Proof Generation  │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Primus Attestor    │
                    │      Network       │
                    └─────────┬──────────┘
                              │
                              │ Attestation
                              ▼
                    ┌────────────────────┐
                    │   ArcPass Backend  │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ ArcPass Attestation│
                    │      Registry      │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │   ArcPass Apps /   │
                    │     Verifiers      │
                    └────────────────────┘
```

---

# 22. Security Principles

A Primus-inspired integration should:

* minimize exposed Web2 data
* use selective disclosure
* verify proof authenticity
* verify attestor signatures
* prevent replay attacks
* use nonces where required
* validate proof expiration
* prevent duplicate attestations
* separate credentials from application data
* avoid storing raw sensitive Web2 information
* validate the target data source
* protect backend credentials

---

# 23. Summary

Primus provides an important reference for ArcPass because it demonstrates how **Web2 data can become cryptographically verifiable without simply trusting a centralized API**.

The most relevant concepts are:

`zkTLS`

`Attestors`

`Data Templates`

`Cryptographic Attestations`

`Selective Disclosure`

`On-Chain Verification`

`Web2 → Web3 Data Verification`

`Privacy-Preserving Computation`

These concepts can be adapted into ArcPass as additional attestation providers rather than replacing the core ArcPass attestation architecture.

# Human Passport (formerly Gitcoin Passport) — Feature Reference

## Purpose

Human Passport is a Sybil-resistance and identity/reputation platform that aggregates multiple verifiable identity signals into a Passport. Its core concept is **Stamps**: verifiable credentials from Web2 and Web3 identity providers. Stamps are weighted and combined into a score that applications can use for access control or other trust decisions.

> Reference: Human Passport documentation. The Passport workstream spun out of Gitcoin in August 2024.

## Core Features

### 1. Passport

A user's Passport is the container for their verified identity signals.

It can contain credentials from multiple providers without requiring the application to directly integrate every provider.

### 2. Stamps

A Stamp represents one or more verifiable credentials from an identity provider.

Examples include signals from:

- Google
- Discord
- GitHub
- LinkedIn
- ENS
- BrightID
- Biometrics
- Government ID
- Phone verification
- Safe
- Snapshot
- X/Twitter
- NFT/activity signals
- ZK Email
- Other identity and reputation providers

Passport documentation states that Stamps do not store personally identifiable information in the Stamp itself; they represent verifiable credentials supplied by identity authenticators.

### 3. Weighted Scoring

Each credential can contribute a different number of points.

The overall Passport score is calculated from the weights of the user's verified credentials.

This allows stronger identity signals to contribute more than weaker signals.

### 4. Sybil Resistance

Applications can use the score as a signal for determining whether a wallet/user is likely to be a unique human rather than a Sybil account.

A common model is:

```text
Stamps
   ↓
Credential weights
   ↓
Passport score
   ↓
Threshold
   ↓
Pass / Fail
```

Passport currently recommends a score threshold of 20 as a general starting point, but developers can choose their own threshold.

### 5. Custom Scorers

Developers can customize scoring for their application.

A custom scorer can:

- Change the score threshold.
- Increase or decrease the weight of specific credentials.
- Require specific Stamps.
- Combine required credentials with an overall score threshold.

This is useful because a DAO, game, airdrop, or financial application may require different trust signals.

### 6. Individual Verification

Human Passport also supports stronger individual verification methods, including:

- KYC
- Phone verification
- Biometrics
- AML-related checks

These are intended for applications requiring stronger identity or compliance guarantees.

### 7. ML-Based Models

Passport provides ML-powered scoring options designed for lower-friction verification.

This is separate from the traditional Stamp aggregation model.

### 8. Passport Embed

Partners can embed Passport verification flows into their own websites or dApps.

A typical flow is:

```text
Partner App
    ↓
Connect / Sign in with Ethereum
    ↓
Passport verification
    ↓
Retrieve score
    ↓
Compare against threshold
    ↓
Grant / deny access
```

### 9. Developer API

Human Passport provides a Stamps API for applications.

The API can provide:

- Current score
- Pass/fail status
- Score threshold
- Timestamp
- Expiration information
- Verified Stamps
- Stamp scores
- Deduplication information
- Stamp metadata
- Historical score information

The current API v2 uses a Scorer ID and API key.

### 10. On-Chain Integration

Passport can also make identity/reputation data available on-chain.

Its smart-contract stack uses Passport contracts together with Ethereum Attestation Service (EAS).

Developers can retrieve:

- Passport data
- Stamps
- Scores
- Humanity status

The contract stack includes methods such as:

```text
getPassport(userAddress)
getScore(userAddress)
getScore(scorerId, userAddress)
isHuman(userAddress)
```

### 11. EAS-Based Attestations

Passport can mint Passport-related attestations to EAS when a user opts to put their Passport data on-chain.

This makes Passport data consumable by other on-chain applications.

### 12. Deduplication

Passport can detect when the same credential has already been associated with another address.

A deduplicated credential can contribute zero score to prevent users from simply copying the same identity signal across multiple wallets.

### 13. Credential Expiration

Credentials/Stamps can expire.

The API exposes expiration information so applications can avoid relying on stale identity signals.

### 14. Historical Scores

Developers can retrieve historical score information through the API.

This can be useful for auditing, analytics, and understanding changes in a user's trust profile.

### 15. Access Gating

Passport can be used to gate:

- Airdrops
- Grants
- Faucets
- Governance
- Polls
- Communities
- Events
- Content
- Other applications

The application determines the required threshold or custom scoring rules.

## Main Architecture

```text
             Identity Providers
       ┌────────┬────────┬────────┐
       │ Google │ GitHub │ ENS    │
       │ BrightID│ Bio  │ Gov ID │
       └────┬───┴────┬───┴───┬────┘
            │         │       │
            └─────────┼───────┘
                      ▼
                   STAMPS
                      │
                      ▼
              Credential Weights
                      │
                      ▼
                Passport Score
                      │
              ┌───────┴────────┐
              │                │
              ▼                ▼
        Passport API       On-chain
              │            Attestations
              │                │
              └───────┬────────┘
                      ▼
                 dApp / DAO
                      │
                 Threshold
                      │
                 Pass / Fail
```

## Features Worth Learning for ArcPass

### High Priority

- Multi-source credential aggregation
- Schema/credential abstraction
- Weighted trust scoring
- Custom scoring rules
- Credential expiration
- Credential deduplication
- API-based verification
- On-chain attestations
- Holder-facing Passport
- Developer integration
- Access-control use cases

### UX Ideas

A strong ArcPass equivalent could show:

```text
My Passport

Humanity Score
82 / 100

✓ Identity
✓ Developer
✓ Education
✓ Employment
✓ Reputation

Credentials
────────────────────
Government ID       Verified
GitHub              Verified
Education           Verified
Employment          Verified

[Share Proof]
[Generate ZK Proof]
```

## Important Design Lesson

Human Passport's major strength is not simply storing credentials. It creates a **composable trust layer** where many independent signals can be combined and then consumed by applications through an API or on-chain interface.

For ArcPass, the useful idea is:

```text
Multiple Attestations
        ↓
Credential Graph
        ↓
Trust / Reputation Signals
        ↓
Custom Policy
        ↓
Verification Result
```

## Sources

- Human Passport Stamps overview
- Human Passport Scoring documentation
- Human Passport Stamps API v2
- Human Passport smart-contract documentation

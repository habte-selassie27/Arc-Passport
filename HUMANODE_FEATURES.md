# Humanode — Feature Reference

## Purpose

Humanode is a biometric proof-of-personhood and Sybil-resistance system built around **Proof of Biometric Uniqueness (PoBU)**.

Its core proposition is:

> One unique living human should be able to create one verified human identity/account.

Unlike traditional KYC, the core goal is not necessarily to reveal a person's legal identity. The system focuses on proving that an account corresponds to a unique, living human.

## Core Features

### 1. Proof of Biometric Uniqueness (PoBU)

PoBU verifies that a person is:

- A real human.
- Alive.
- Biometrically unique within the relevant system.

The resulting proof can be used for Sybil resistance and other identity-aware applications.

### 2. Facial Biometric Verification

Humanode uses facial biometrics as its primary biometric mechanism.

The user performs a face scan and the system derives an anonymized biometric representation.

### 3. Liveness Detection

The system checks that the person in front of the camera is actually alive rather than:

- A photograph
- A video
- A deepfake
- A mask
- Another presentation attack

Humanode has described both active and passive liveness approaches.

### 4. Uniqueness Matching

The biometric representation is compared against existing registered biometric representations to determine whether the person is already registered.

Conceptually:

```text
Face Scan
   ↓
Liveness Check
   ↓
Biometric Representation
   ↓
1:N Uniqueness Check
   ↓
Unique / Already Registered
```

### 5. Privacy-Preserving Biometrics

Humanode's architecture is designed so that raw facial images are not exposed as ordinary application data.

Humanode describes converting biometric information into an anonymized/cryptographic representation and processing sensitive operations inside confidential infrastructure.

### 6. Confidential Virtual Machines

Humanode uses Confidential Virtual Machine infrastructure for sensitive biometric processing.

The stated goal is to keep biometric processing protected even from infrastructure operators.

Humanode has described AMD SEV-SNP-based confidential computing in this architecture.

### 7. Encrypted Biometric Processing

Biometric information is encrypted before sensitive processing.

The architecture aims to avoid exposing raw biometric information to ordinary application servers.

### 8. Anonymous / Pseudonymous Identity

The system can prove uniqueness without requiring the application to know the user's legal identity.

This allows:

```text
"Is this a unique human?"

without necessarily requiring:

"Who exactly is this person?"
```

That distinction is important for privacy-preserving Web3 applications.

### 9. Wallet Linking

Humanode can associate a verified biometric identity with an EVM wallet/account.

A simplified flow is:

```text
Biometric Verification
        ↓
Unique Human Proof
        ↓
Connect Wallet
        ↓
Sign Message
        ↓
Wallet Ownership Verification
        ↓
On-chain uniqueness record
```

### 10. On-Chain Verification

Humanode has mechanisms for turning successful biometric verification into an on-chain verifiable state.

This allows external applications to consume uniqueness information rather than directly accessing biometric data.

### 11. Biomapper

Biomapper provides an identity/uniqueness mapping layer that can connect a verified human to blockchain identities.

Humanode's current roadmap describes Biomapper as a uniqueness layer capable of mapping one human to one wallet and supporting cross-chain verification.

### 12. Cross-Chain Identity

Humanode's current roadmap describes cross-chain Biomapper capabilities and verification across connected EVM networks.

This is important for applications that want one human identity to be recognized across multiple chains.

### 13. Reusable Proof

The goal is to verify the person once and then allow the resulting uniqueness signal to be reused by applications.

This is significantly better UX than forcing users to complete biometric verification separately for every application.

### 14. Sybil Resistance

PoBU can be used to prevent one person from creating unlimited accounts.

Potential applications include:

- Airdrops
- DAO voting
- Governance
- Whitelists
- Social applications
- Dating
- Marketplaces
- Gaming
- Bot prevention
- Human-only communities

### 15. One Human → One Account

The fundamental security property is:

```text
1 human
   ↓
1 uniqueness identity
   ↓
1 account / permitted identity mapping
```

This makes the primitive useful for applications where one-person-one-account or one-person-one-vote is important.

### 16. Bot / AI Resistance

Humanode positions PoBU as a defense against synthetic identities, bots, and AI-generated accounts.

The liveness + uniqueness combination is intended to make mass creation of fake human accounts substantially harder.

### 17. Humanode Applications

Humanode has built or described products around the same underlying primitive, including:

- Biomapper
- BotBasher
- OAuth2-style integrations
- Human-node authentication
- Web3 Sybil resistance

The underlying idea is to expose **human uniqueness as a reusable primitive**.

## Main Architecture

```text
                  USER
                   │
                   ▼
             Camera / Face
                   │
                   ▼
            Liveness Check
                   │
                   ▼
          Biometric Processing
                   │
            Encrypted Data
                   │
                   ▼
        Confidential Environment
                   │
                   ▼
          Uniqueness Matching
                   │
            ┌──────┴──────┐
            │             │
        Unique          Duplicate
            │
            ▼
       Human Proof
            │
            ▼
      Wallet Binding
            │
            ▼
       Attestation /
       On-chain Record
            │
            ▼
      External dApps
```

## Privacy Model

The important privacy principle is:

```text
Raw face
   ✕
   │
   │ should not become ordinary application data
   │
   ▼
Encrypted / anonymized representation
   ↓
Confidential processing
   ↓
Uniqueness result
   ↓
Proof / attestation
   ↓
Application
```

The application should ideally receive something equivalent to:

```text
uniqueHuman = true
```

rather than:

```text
face = <raw biometric data>
name = ...
passport = ...
```

## Features Worth Learning for ArcPass

### High Priority

- Proof of uniqueness
- Liveness verification
- Privacy-preserving biometric processing
- Confidential computing
- Wallet binding
- On-chain uniqueness records
- Reusable identity proofs
- Cross-chain verification
- Sybil resistance
- Human-only access control

### UX Ideas

A strong ArcPass human-verification flow could look like:

```text
Verify Humanity

Step 1
Connect Wallet
✓ 0x82...91

Step 2
Prove You're Human

[ Start Verification ]

Camera verification
████████████░░ 80%

✓ Liveness verified
✓ Unique human verified

Step 3
Create Proof

Your biometric information
is not shared with the application.

[Generate Human Proof]

✓ Proof generated
```

Then:

```text
Humanity Credential

✓ Unique Human
✓ Liveness Verified
✓ Not Previously Registered

Issuer
ArcPass Human Verification

Wallet
0x82...91

Valid Until
...

[View Credential]
[Generate ZK Proof]
```

## Important Design Lesson

Humanode demonstrates a different identity primitive from a normal credential system.

Traditional identity:

```text
Who are you?
```

Humanode-style proof of personhood:

```text
Are you a unique living human?
```

ArcPass can potentially support both:

```text
                 ARCPASS
                    │
          ┌─────────┴─────────┐
          │                   │
     Identity Claims      Humanity Proof
          │                   │
     KYC / Education       PoBU-style
     Employment             verification
     Credentials             │
          │                   │
          └─────────┬─────────┘
                    ▼
             Privacy Layer
                    │
                    ▼
              ZK / Selective
                 Disclosure
                    │
                    ▼
               Verifier
```

## Important Security Consideration

Biometrics are highly sensitive. ArcPass should not simply copy a centralized biometric database model.

If implementing biometric uniqueness, carefully evaluate:

- Raw biometric retention
- Encryption
- Key management
- Confidential computing
- Remote attestation
- Template protection
- Revocation
- Recovery
- Wallet unlinking
- Multiple-wallet attacks
- Liveness attacks
- Deepfakes
- Presentation attacks
- False positives
- False negatives
- Legal/privacy requirements
- Trusted execution environment assumptions

## Sources

- Humanode Proof of Biometric Uniqueness documentation
- Humanode biometric authentication architecture
- Humanode privacy documentation
- Humanode roadmap

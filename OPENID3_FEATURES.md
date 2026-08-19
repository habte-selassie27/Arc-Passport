# OpenID3 — Feature Reference

## Overview

OpenID3 is a decentralized identity/authentication approach focused on bringing Web2 account-based authentication into Web3 while reducing dependence on a single centralized authentication provider.

Its core idea is to create **verifiable Web2 identity proofs** that can be associated with Web3 identities without requiring applications to blindly trust the original Web2 authentication provider.

---

# 1. Web2 Identity Authentication

OpenID3 focuses on verifying ownership/control of Web2 identities.

Potential identity sources include:

* email
* social accounts
* Web2 accounts
* OAuth-based identities
* other supported online identities

The objective is:

`Web2 Account → Cryptographic Verification → Web3 Identity`

---

# 2. Decentralized Authentication

Traditional OAuth/OTP authentication usually depends on a centralized service.

OpenID3 introduces a decentralized witness model so that authentication results can become independently verifiable.

Instead of:

```text
User
  ↓
Centralized Provider
  ↓
"User authenticated"
```

the architecture can become:

```text
User
  ↓
Web2 Authentication
  ↓
Decentralized Witness Network
  ↓
Cryptographic Proof
  ↓
Web3 Application
```

---

# 3. DAuth Network

The DAuth concept provides decentralized witnesses for Web2 identity authentication.

Witnesses participate in verifying the relationship between:

* user
* Web2 account
* authentication event
* Web3 identity

This reduces dependence on a single witness.

---

# 4. Web2 Account Ownership

A major use case is proving that a Web3 identity controls a particular Web2 account.

Potential examples:

* X/Twitter account
* GitHub account
* Discord account
* email identity
* other supported social accounts

A resulting credential can state a claim such as:

```text
Wallet X controls Web2 Account Y
```

without requiring every application to repeat the entire authentication flow.

---

# 5. Social Identity Attestations

OpenID3-style infrastructure can turn social-account ownership into reusable attestations.

Examples:

```text
GitHub account verified
X account verified
Discord account verified
Email verified
```

These claims can become part of a decentralized identity profile.

---

# 6. Web2 → Web3 Identity Linking

A key capability is establishing a verifiable relationship between Web2 and Web3 identities.

Conceptually:

```text
Web2 Identity
      │
      │ authentication proof
      ▼
Decentralized Witness
      │
      │ attestation
      ▼
Web3 Wallet
```

Applications can then use the resulting credential for identity and access decisions.

---

# 7. Privacy Preservation

A major motivation is avoiding unnecessary linking of all Web2 and Web3 accounts.

Instead of exposing:

```text
Wallet
+
Email
+
X
+
GitHub
+
Discord
```

applications can request only the claim they need.

For example:

```text
"User controls a verified GitHub account"
```

rather than exposing the complete identity profile.

---

# 8. Reusable Identity Proofs

Once a Web2 identity has been verified, the resulting credential can potentially be reused.

This avoids requiring every application to independently authenticate the same Web2 account.

Conceptually:

```text
Authenticate Once

        ↓

Issue Credential

        ↓

┌──────────────┬──────────────┬──────────────┐
│   dApp A     │    dApp B    │    dApp C    │
└──────────────┴──────────────┴──────────────┘
        │
        ▼
   Verify Credential
```

---

# 9. Decentralized Witnesses

Instead of trusting a single centralized authentication server, a decentralized witness network can participate in verification.

Benefits include:

* reduced single point of failure
* independently verifiable authentication
* greater resilience
* reduced dependency on one provider

---

# 10. Authentication Proofs

The authentication process can produce cryptographic evidence that can be verified by another party.

A verifier should be able to determine:

* what identity was authenticated
* what Web2 service was involved
* which wallet/user received the claim
* who witnessed the authentication
* whether the credential is valid
* whether the credential has expired or been revoked

---

# 11. Credential Issuance

After successful authentication, the system can issue an identity credential/attestation.

Example:

```text
Credential
────────────────────────
Subject: Wallet
Provider: GitHub
Claim: Account Ownership
Status: Valid
Issued: timestamp
Expires: timestamp
Issuer: Witness
────────────────────────
```

The credential can then be consumed by applications.

---

# 12. Credential Verification

Applications should not need to trust the frontend.

A verifier can check:

1. credential structure
2. issuer
3. issuer signature
4. subject
5. claim
6. expiration
7. revocation status
8. nonce/replay protection

Only after successful validation should the application treat the identity claim as valid.

---

# 13. Identity Reputation

Verified Web2 accounts can become identity/reputation signals.

Examples:

* verified GitHub
* verified social account
* verified email
* account age
* account activity

Applications can combine these signals into broader reputation systems.

For example:

```text
GitHub Verified
       +
X Verified
       +
Email Verified
       +
Human Verified
       ↓
Identity / Reputation Score
```

---

# 14. Sybil Resistance

Web2 identity proofs can become one component of Sybil-resistance systems.

For example, an application may require:

```text
Human Proof
+
GitHub Account
+
Social Account
```

rather than relying on wallet addresses alone.

This is particularly useful for:

* airdrops
* DAO participation
* reputation systems
* community access
* grants
* developer programs

---

# 15. Web3 Onboarding

OpenID3-style authentication can make Web3 onboarding more familiar to Web2 users.

Instead of requiring a user to immediately understand complex wallet flows:

```text
Web2 Identity
      ↓
Authenticate
      ↓
Generate / Connect Web3 Identity
      ↓
Receive Credential
      ↓
Access dApp
```

This can reduce onboarding friction.

---

# 16. Account Abstraction Compatibility

The identity layer can potentially be combined with smart accounts/account abstraction.

For example:

```text
Web2 Authentication
        ↓
Identity Credential
        ↓
Smart Account
        ↓
Web3 Application
```

This can enable more familiar authentication experiences without making Web2 credentials equivalent to private keys.

---

# 17. Access Control

Verified Web2 identities can be used as access-control conditions.

Examples:

```text
GitHub verified → Developer access
Discord verified → Community access
Email verified → Basic access
Multiple identities → Premium access
```

The application can verify credentials before granting access.

---

# 18. DAO / Governance Use Cases

Web2 identity credentials can provide additional governance signals.

Possible applications:

* contributor verification
* developer verification
* community membership
* reputation-based governance
* anti-Sybil voting
* grant eligibility

Identity credentials should complement—not necessarily replace—wallet-based governance.

---

# 19. Credential Revocation

Identity credentials should support lifecycle management.

Possible states:

```text
ACTIVE
EXPIRED
REVOKED
SUSPENDED
```

Revocation can occur when:

* account ownership changes
* authentication becomes invalid
* issuer invalidates a credential
* security incident occurs

---

# 20. Credential Expiration

Credentials should optionally contain expiration timestamps.

This prevents a verification performed years ago from being treated as permanently valid.

Example:

```text
Issued: 2026-08-19
Expires: 2027-08-19
```

Applications should verify expiration before accepting the credential.

---

# 21. Selective Disclosure

Applications should request only the identity property they need.

For example:

Instead of:

```text
Give me the user's complete identity.
```

request:

```text
Prove that the user controls a GitHub account.
```

This improves privacy and minimizes unnecessary identity correlation.

---

# 22. Anti-Replay Protection

Authentication proofs should not be reusable in unintended contexts.

Use mechanisms such as:

* nonces
* timestamps
* domain/application binding
* challenge-response
* expiration
* unique credential IDs

The proof should be bound to the intended verifier or application when appropriate.

---

# 23. Multi-Provider Identity

An identity system can aggregate multiple Web2 providers.

Example:

```text
                    ┌── GitHub
                    │
Wallet ── Identity ─┼── X
                    │
                    ├── Discord
                    │
                    └── Email
```

This creates a richer decentralized identity profile.

---

# 24. Identity Aggregation

Multiple credentials can be combined into an identity profile.

Example:

```text
Human Proof
GitHub Proof
Social Proof
Email Proof
Employment Proof
Education Proof
        │
        ▼
   Identity Profile
```

A verifier can choose which claims are relevant.

---

# 25. Features Relevant to ArcPass

The most useful OpenID3-inspired capabilities for ArcPass are:

* Web2 account verification
* social-account attestations
* decentralized authentication witnesses
* Web2 → wallet identity linking
* reusable identity credentials
* selective disclosure
* credential expiration
* credential revocation
* anti-replay protection
* multi-provider identity
* identity aggregation
* Sybil-resistance signals
* Web2-friendly onboarding
* decentralized verification

---

# 26. Potential ArcPass Integration

OpenID3 should be treated as an **identity/attestation provider** inside ArcPass.

Conceptually:

```text
                     ArcPass
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
    Humanode         Primus           OpenID3
   Human Proof      zkTLS/Web2       Web2 Identity
        │               │                │
        └───────────────┼────────────────┘
                        ▼
                ArcPass Attestation
                       Layer
                        │
                        ▼
                Passport / Profile
                        │
                        ▼
                    Verifiers
```

OpenID3 can provide Web2 identity claims while ArcPass handles:

* credential normalization
* schemas
* attestation storage
* verification
* reputation aggregation
* access-control decisions
* application-facing APIs

---

# 27. Security Principles

An OpenID3-inspired integration should:

* never treat a frontend authentication response as sufficient proof
* verify witness signatures
* bind proofs to the intended wallet
* use nonces
* prevent replay
* support expiration
* support revocation
* minimize identity correlation
* avoid storing unnecessary Web2 credentials
* protect OAuth/session secrets
* separate authentication from authorization
* validate the issuer
* validate the identity provider
* maintain an auditable verification history

---

# 28. Reference Architecture

```text
┌─────────────────────┐
│      User           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Web2 Provider     │
│ GitHub/X/Discord/...│
└──────────┬──────────┘
           │
           │ Authentication
           ▼
┌─────────────────────┐
│   DAuth / Witness   │
│       Network       │
└──────────┬──────────┘
           │
           │ Signed Proof
           ▼
┌─────────────────────┐
│    ArcPass Backend  │
│ Verification Layer  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Attestation Registry│
│     / Credential    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     ArcPass User    │
│      Identity       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      Verifiers      │
│       / dApps       │
└─────────────────────┘
```

---

# 29. Summary

OpenID3 is a useful reference for ArcPass's **Web2 identity attestation layer**.

The most relevant concepts are:

`Web2 Authentication`

`DAuth`

`Decentralized Witnesses`

`Social Account Verification`

`Web2 → Web3 Identity Linking`

`Reusable Credentials`

`Selective Disclosure`

`Credential Revocation`

`Credential Expiration`

`Anti-Replay Protection`

`Multi-Provider Identity`

`Sybil Resistance`

These capabilities can be integrated into ArcPass as an **OpenID3/Web2 Identity Attestation Provider** alongside Humanode, Primus, EAS, ZKPassport, and other verification providers.

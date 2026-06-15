# ArcPass Architecture

## Overview

ArcPass is a decentralized onchain identity and attestation protocol on Arc L1 — a stablecoin-native EVM-compatible Layer-1 blockchain by Circle.

## System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend   │────▶│   Backend    │────▶│  Smart       │
│  (React 19) │◀────│  (Express)   │◀────│  Contracts   │
│  + wagmi    │     │  + Circle    │     │  (Foundry)   │
│  + viem     │     │  + Pinata    │     │  + UUPS      │
└─────────────┘     └──────────────┘     └──────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │   Arc L1     │
                    │  (Testnet)   │
                    │  Chain 5042002  │
                    └──────────────┘
```

## Smart Contracts

### Contract Addresses (Arc Testnet)

```
IdentityRegistry:   0x8004A818BFB912233c491871b3d84c89A494BD9e (deployed by Arc)
ReputationRegistry: 0x8004B663056A597Dffe9eCcC1965A193B7388713 (deployed by Arc)
USDC ERC-20:        0x3600000000000000000000000000000000000000
```

### ArcPass Deployed Contracts

| Contract | Type | Upgradeable | Purpose |
|----------|------|-------------|---------|
| SchemaRegistry | UUPS Proxy | Yes | Schema definitions |
| AttestationRegistry | UUPS Proxy | Yes | Claim issuance/revocation |
| PassportVerifier | Stateless | No | Read-only verification |

### Core Data Flow

1. **Schema Registration**: Anyone registers a schema (name, version, fields JSON)
2. **Claim Issuance**: Issuer (ISSUER_ROLE) calls `attest()` with subject, schema, data commitment
3. **Verification**: Relying party calls `verify()` on PassportVerifier
4. **Revocation**: Revoker (REVOKER_ROLE) calls `revoke()` to invalidate a claim
5. **Selective Disclosure**: Subject presents Merkle proof for individual fields

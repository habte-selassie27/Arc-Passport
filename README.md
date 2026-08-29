<p align="center">
  <img src="https://img.shields.io/badge/Arc%20Testnet-5042002-7C3AED?style=for-the-badge&labelColor=1a1a2e" alt="Arc Testnet" />
  <img src="https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity" alt="Solidity" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge" alt="Express" />
  <img src="https://img.shields.io/badge/Foundry-Forge-F2E94B?style=for-the-badge" alt="Foundry" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">
  <br>
  <code>⬡ ArcPassport</code>
  <br>
  <sub>Identity. Attestation. Verification.</sub>
</h1>

<p align="center">
  <b>A programmable identity layer for the Arc ecosystem.</b><br>
  Build your passport, receive verifiable attestations, and prove what matters — on-chain.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-features">Features</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-smart-contracts">Contracts</a> •
  <a href="#-deployment">Deploy</a>
</p>

---

## Overview

ArcPassport is a wallet-linked, verifiable identity and attestation platform built on Arc Testnet. Users connect a wallet, build a public Passport, receive attestations from issuers, and anyone can verify them — trustlessly, on-chain.

```
Connect Wallet → Create Passport → Receive Attestations → Verify → Share
```

**Core value proposition:** Make ArcPass the place where anyone building on Arc issues verifiable credentials, and any app verifies them.

---

## Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org) | `>= 20` | Backend + Frontend |
| [Foundry](https://getfoundry.sh) | Latest | Contract compilation & deployment |
| [Arc Testnet USDC](https://faucet.testnet.arc.network) | — | Gas for transactions |

### 1. Clone & Install

```bash
git clone https://github.com/habte-selassie27/Arc-Passport.git
cd Arc-Passport

# Install all three workspaces
cd contracts && forge install
cd ../backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend — copy and fill in your keys
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env

# Contracts
cp contracts/.env.example contracts/.env
```

See [Environment Variables](#-environment-variables) for the full reference.

### 3. Deploy Contracts

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url $ARC_RPC_URL --broadcast
forge script script/GrantIssuerRole.s.sol --rpc-url $ARC_RPC_URL --broadcast
forge script script/RegisterSchemas.s.sol --rpc-url $ARC_RPC_URL --broadcast
```

### 4. Run Development Servers

```bash
# Terminal 1 — Backend (port 3001)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and connect your wallet.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│  wagmi 2 · viem 2 · TanStack Query · Tailwind CSS  │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────┐
│               Backend API (Express)                  │
│   Auth · Issuer Guard · Rate Limit · Zod Validation │
└────────┬─────────────┬────────────────┬─────────────┘
         │             │                │
    ┌────▼────┐  ┌─────▼─────┐  ┌──────▼──────┐
    │  Arc    │  │  Circle   │  │   Pinata    │
    │  RPC    │  │  SDK      │  │   (IPFS)    │
    └────┬────┘  └─────┬─────┘  └──────┬──────┘
         │             │                │
┌────────▼─────────────▼────────────────▼─────────────┐
│              Arc Testnet (5042002)                   │
│  AttestationRegistry · SchemaRegistry · PassportVerifier  │
│  HumanityOracle · ScoreRegistry · ZKVerifier        │
└─────────────────────────────────────────────────────┘
```

### Source of Truth

| Layer | Role |
|-------|------|
| **Blockchain** | Source of truth for on-chain state (claims, revocations, expiry) |
| **Database** | Indexed / application state — advisory, never authoritative for validity |
| **Frontend** | Presentation state only — never trusts its own cached data |

---

## Features

### For Passport Holders

| Feature | Description |
|---------|-------------|
| **Wallet-Linked Identity** | Connect any EVM wallet to create your passport |
| **Public Passport** | Shareable at `/passport/:address` — viewable by anyone |
| **Verifiable Attestations** | On-chain claims with Merkle-based selective disclosure |
| **Trust Score** | Transparent, category-weighted reputation signals |
| **Notifications** | Alerts for new attestations and expiring credentials |
| **Privacy Controls** | Selective disclosure via Merkle proofs — prove attributes without revealing raw data |

### For Issuers

| Feature | Description |
|---------|-------------|
| **Multi-Service Architecture** | 9 attestation categories: Identity, KYC, Credentials, DAO, Reputation, Employment, Education, Social, Custom |
| **Circle MPC Wallets** | No private keys in code — Circle Developer-Controlled Wallets sign transactions |
| **Schema Registry** | Register and version claim schemas on-chain |
| **Batch Attestation** | Issue up to 100 claims per transaction |
| **Web2 Proofs** | OAuth-based account verification with zkTLS support |
| **World ID Integration** | One-human-per-account biometric verification |

### For Verifiers

| Feature | Description |
|---------|-------------|
| **PassportVerifier Contract** | Stateless, read-only — any dApp can gate access on-chain |
| **REST API** | `GET /v1/verify/:address` returns trust score and claim validity |
| **EAS Compatible** | Interoperable with the Ethereum Attestation Service ecosystem |
| **Explorer Links** | Direct links to ArcScan for every on-chain transaction |

---

## Smart Contracts

### Core Contracts

| Contract | Type | Description |
|----------|------|-------------|
| `AttestationRegistry` | UUPS Upgradeable | The credential store — issuance, revocation, lifecycle management |
| `SchemaRegistry` | UUPS Upgradeable | Immutable claim schema definitions |
| `PassportVerifier` | Immutable | Stateless read-only verification for third-party dApps |
| `BatchAttestation` | Extension | Batch issuance — up to 100 claims per tx |

### Extensions

| Contract | Description |
|----------|-------------|
| `ExpiringClaims` | Time-bounded attestations with automatic expiry |
| `DelegatedAttestation` | Delegate issuance authority to third parties |
| `HumanityOracle` | On-chain biometric liveness verification |

### Roles

| Role | Purpose |
|------|---------|
| `ISSUER_ROLE` | Can call `attest()` and `attestWithRef()` |
| `REVOKER_ROLE` | Emergency revocation via `adminRevoke()` |
| `PAUSER_ROLE` | Emergency pause controls |
| `UPGRADER_ROLE` | Authorize UUPS implementation upgrades |
| `DEFAULT_ADMIN_ROLE` | Administrative operations (held by multisig) |

### Key Design Principles

- **One active claim per `(subject, schemaId, issuer)` triple** — re-issuance requires revoking the previous
- **`dataCommitment` is a Merkle root** — raw data lives off-chain, disclosed via `verifyField()`
- **All reverts use custom errors** — no string `require()` messages
- **USUPS upgradeable** — proxy address is permanent; implementations change on upgrade
- **No `SELFDESTRUCT`**, no `prevrandao` usage — Arc-native constraints

---

## API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/passport/:address` | Get passport with claims and trust score |
| `GET` | `/passport/:address/attestations` | Get all attestations for an address |
| `GET` | `/v1/verify/:address` | Verify passport — returns `{ passed, score, threshold }` |
| `GET` | `/v1/verify/:address?schemaId=0x...` | Verify a specific schema |
| `GET` | `/v1/notifications/:address` | Get notifications (public, no auth) |
| `GET` | `/schema` | List registered schemas |

### Authenticated Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/attestation/attest` | Signed nonce + Issuer guard | Issue a new attestation |
| `POST` | `/attestation/:id/revoke` | Signed nonce | Revoke a claim |
| `POST` | `/v1/attest/web2-proof` | Signed nonce + Issuer guard | Issue via web2-proof flow |
| `POST` | `/web2-proof/start` | Signed nonce | Start web2 verification |
| `POST` | `/web2-proof/callback` | Signed nonce | Complete web2 verification |
| `POST` | `/v1/notifications/:address/read` | Signed nonce | Mark notifications as read |

### Authentication

All write endpoints require a signed nonce:

```
x-wallet-address: 0x...
x-nonce: <uuid>
x-signature: <EIP-191 signature of "ArcPass:<path>:<nonce>">
```

---

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Landing page with feature overview |
| `/passport/:address` | Passport | Public passport view — works without wallet connection |
| `/register` | Register | Create or manage your identity |
| `/credentials` | Credentials | View and manage your credentials |
| `/world-id` | World ID | World ID biometric verification |
| `/web2-proof` | Web2 Proof | Verify Web2 account ownership |
| `/eas` | EAS | Ethereum Attestation Service compatibility |
| `/zk` | ZK Passport | Zero-knowledge selective disclosure |
| `/guide` | Guide | User onboarding guide |
| `/studio/*` | Studio | Issuer dashboard — schemas, analytics, settings |

---

## Tech Stack

| Layer | Tools |
|-------|-------|
| **Contracts** | Solidity 0.8.24, Foundry, Prague EVM, OpenZeppelin 5 (upgradeable) |
| **Backend** | Node.js 20+ (ESM), Express 4, TypeScript strict, viem 2, Circle SDK, Pinata IPFS, zod, vitest |
| **Frontend** | React 19, Vite 5, TypeScript strict, wagmi 2, viem 2, TanStack Query 5, Tailwind CSS 4 |
| **Network** | Arc Testnet (chain `5042002`), USDC gas, ArcScan explorer |

---

## Environment Variables

### Arc Network

```bash
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
ARC_BLOCKCHAIN_ENV=ARC-TESTNET
```

### Circle SDK (Issuer Wallets)

```bash
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret
CIRCLE_ISSUER_WALLET_ID=wallet_id
```

### Contract Addresses

```bash
ATTESTATION_REGISTRY_ADDRESS=0x...
SCHEMA_REGISTRY_ADDRESS=0x...
PASSPORT_VERIFIER_ADDRESS=0x...
```

### IPFS (Pinata)

```bash
PINATA_API_KEY=your_key
PINATA_SECRET_KEY=your_secret
```

See [`backend/.env.example`](backend/.env.example) for the full list of ~50 environment variables.

---

## Testing

```bash
# Contracts — Foundry
cd contracts && forge build && forge test

# Backend — Vitest
cd backend && npm run typecheck && npm test

# Frontend — Vitest
cd frontend && npm run typecheck && npm test
```

### Test Coverage

| Priority | Area |
|----------|------|
| **Critical** | Passport creation, wallet ownership, attestation issuance/verification/revocation/expiry |
| **High** | Authorization (every role-gated function has unauthorized-caller revert tests) |
| **High** | Arc specifics (USDC decimals, schema ID parity on-chain vs off-chain) |
| **Medium** | Contract edge cases (zero address, duplicate claims, already-revoked, expired) |
| **Medium** | API endpoints (auth, issuer guard, verify) |

---

## Deployment

### After Every Registry Redeploy

```bash
# 1. Reset indexer state
echo '{"claims":[]}' > backend/.indexer-state.json

# 2. Update .env
# ATTESTATION_REGISTRY_ADDRESS=<new_address>

# 3. Re-grant ISSUER_ROLE
cd contracts
forge script script/GrantIssuerRole.s.sol --rpc-url $ARC_RPC_URL --broadcast

# 4. Re-register schemas
forge script script/RegisterSchemas.s.sol --rpc-url $ARC_RPC_URL --broadcast

# 5. Issue a test claim and verify
curl -X POST http://localhost:3001/v1/attest/web2-proof -H "Content-Type: application/json" -d '{"subject":"0x...","schemaId":"0x...","proofData":{...}}'
cast call $ATTESTATION_REGISTRY_ADDRESS "isValid(bytes32)(bool)" <CLAIM_ID>
```

---

## Project Structure

```
arcpass/
├── contracts/                 ← Foundry project (Solidity)
│   ├── src/core/              ← AttestationRegistry, SchemaRegistry, PassportVerifier
│   ├── src/extensions/        ← BatchAttestation, HumanityOracle, ExpiringClaims
│   ├── src/services/          ← On-chain schema IDs, verifier gates
│   ├── script/                ← Deploy, GrantIssuerRole, RegisterSchemas
│   └── test/                  ← Foundry tests incl. integration + gas benchmarks
├── backend/                   ← Node.js / Express API (TypeScript, ESM)
│   └── src/
│       ├── routes/            ← REST endpoints (identity, attestation, passport, ...)
│       ├── services/          ← Business logic (arc, circle, IPFS, attestation services)
│       ├── middleware/         ← Auth (signed nonce), issuer guard, revoker guard
│       ├── indexer/           ← Claim indexer (on-chain events → read model)
│       └── monitoring/        ← Event watchers, gas/balance polling
├── frontend/                  ← React 19 + Vite + wagmi
│   └── src/
│       ├── pages/             ← Home, Passport, Register, World ID, EAS, ZK
│       ├── components/        ← Passport cards, forms, shared UI
│       ├── hooks/             ← useIdentity, useNotifications, useWorldId, ...
│       └── config/            ← Wagmi, known issuers
└── ARCHITECTURE.md            ← System architecture & design principles
```

---

## Security

- **Wallet ownership** verified via signed messages (EIP-191) with anti-replay nonces
- **Issuer authorization** checked on-chain via `hasRole(ISSUER_ROLE, caller)`
- **Circle MPC wallets** — no private keys in application code
- **Rate limiting** — 100 req/min global, 10 req/min for write endpoints
- **Input validation** — zod schemas on every route
- **Custom errors** — no string `require()` messages that leak implementation details

See [SECURITY-ROADMAP.md](SECURITY-ROADMAP.md) for the full threat model and audit findings.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit with conventional commits (`feat:`, `fix:`, `test:`, `chore:`)
4. Run tests (`forge test && npm test` in both workspaces)
5. Push and open a Pull Request

---

## License

MIT

---

<p align="center">
  <sub>Built with care for the Arc ecosystem.</sub><br>
  <sub>⬡ ArcPass — Identity · Attestation · Verification · Arc Testnet</sub>
</p>

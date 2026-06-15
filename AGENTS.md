# AGENTS.md — ArcPass
## Onchain Identity, Attestation & Passport Protocol on Arc L1

---

## ⚠️ SENIOR ENGINEERING ADDENDUM — Five Production Gaps (Read Before Everything Else)

> These five sections were added after initial architecture review. They address the
> exact gaps that separate a deployable proof-of-concept from an auditable production
> identity protocol. Every agent must treat these as **equal in authority to any
> section below**. Where these sections conflict with earlier guidance, **these sections win**.

---

### GAP 1 — Upgradeability: UUPS Proxy Pattern

**Problem**: All three custom contracts (`AttestationRegistry`, `SchemaRegistry`,
`PassportVerifier`) were specified as immutable deploys. For an identity protocol,
a bug in `AttestationRegistry` post-deployment means every existing claim is
permanently anchored to a broken contract. The only recovery path without a proxy
is full state migration — re-issuing every claim to a new address, which requires
every issuer and every downstream verifier to be updated simultaneously. This is
not operationally viable.

**Decision**: Adopt the **UUPS (ERC-1967) proxy pattern** for `AttestationRegistry`
and `SchemaRegistry`. `PassportVerifier` is stateless and read-only — it is
intentionally NOT proxied (no state to migrate, just redeploy and point verifiers
at the new address).

**Why UUPS over Transparent Proxy**:
- `UUPSUpgradeable` puts the upgrade logic inside the implementation contract,
  not the proxy. This means a compromised or malicious proxy admin cannot silently
  redirect calls — the implementation itself controls who can upgrade.
- Lower deployment gas cost than TransparentUpgradeableProxy.
- The upgrade function is exposed only to `DEFAULT_ADMIN_ROLE` (the multisig),
  and can be permanently disabled by calling `_disableInitializers()` on the
  implementation after a stability period.

**Implementation pattern**:

```solidity
// contracts/src/core/AttestationRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract AttestationRegistry is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant ISSUER_ROLE   = keccak256("ISSUER_ROLE");
    bytes32 public constant REVOKER_ROLE  = keccak256("REVOKER_ROLE");
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Storage gap — reserve 50 slots for future state variables
    // MUST be the last declaration in every upgradeable contract
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address multisig) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, multisig);
        _grantRole(UPGRADER_ROLE,      multisig);
        _grantRole(PAUSER_ROLE,        multisig);
        // ISSUER_ROLE is granted separately per issuer — not at init time
    }

    // Only UPGRADER_ROLE (multisig) may authorize an upgrade
    function _authorizeUpgrade(address newImpl)
        internal override onlyRole(UPGRADER_ROLE) {}
}
```

**Storage layout discipline** (CRITICAL — upgrades silently corrupt storage if violated):

```
Rule 1: Never reorder existing state variables between versions.
Rule 2: Never change the type of an existing state variable.
Rule 3: Only append new state variables at the end, before __gap.
Rule 4: Reduce __gap by the number of new slots consumed.
Rule 5: Mappings and dynamic arrays do not consume __gap slots — only value types do.
```

Document every version's storage layout in `docs/storage-layout.md`:

```markdown
## V1 Storage Layout — AttestationRegistry
slot 0-49: AccessControl inherited storage
slot 50:   _claimNonce (uint256)                  <- __gap[0] consumed
slot 51:   mapping claims (mapping — no slot)
slot 52:   mapping _activeClaim (mapping — no slot)
slots 53-102: __gap[1..49]                        <- 49 remaining
```

**Deployment flow**:
```bash
# contracts/script/Deploy.s.sol
AttestationRegistryV1 impl = new AttestationRegistryV1();
ERC1967Proxy proxy = new ERC1967Proxy(
    address(impl),
    abi.encodeCall(AttestationRegistryV1.initialize, (MULTISIG_ADDRESS))
);
# Record proxy address — this is the permanent address all integrators use
# The impl address changes on every upgrade; the proxy address never changes
```

**Upgrade guard in CI**: Before any upgrade script runs, the `Tester` agent must
run `forge inspect AttestationRegistry storage-layout` for both old and new
implementations and diff them. Any slot reordering is a **Critical** block on
the upgrade.

---

### GAP 2 — Privacy Layer: Selective Disclosure Design

**Problem**: The original AGENTS.md mentioned "TEE -> ZK roadmap" as a one-liner.
For a passport protocol, selective disclosure is not optional polish — it is the
core privacy guarantee that makes the product legally and ethically usable.
Without it, presenting your passport reveals all claims to all verifiers, which
is a GDPR violation and a privacy catastrophe for users.

**Architecture**: Two-tier selective disclosure, shipped in sequence.

---

#### Tier 1 — Merkle-Based Selective Disclosure (Ship with V1)

Claim `data` is structured as a Merkle tree of individual fields. The user
presents only the leaf (field) they wish to disclose, plus its Merkle proof.
The verifier confirms the leaf is in the claim's commitment without seeing other fields.

**Why Merkle first**: No ZK toolchain, no trusted setup, no new cryptographic
assumptions. Pure Solidity + `keccak256`. Ships today.

```solidity
// contracts/src/core/AttestationRegistry.sol
struct Claim {
    bytes32   claimId;
    address   subject;
    bytes32   schemaId;
    address   issuer;
    bytes32   dataCommitment;   // <- Merkle root of field leaves, NOT raw data
    uint256   issuedAt;
    uint256   expiresAt;
    bool      revoked;
    // Raw data is NOT stored onchain — only the commitment
}
```

```solidity
// contracts/src/core/PassportVerifier.sol — selective disclosure verification
function verifyField(
    bytes32        claimId,
    bytes32        fieldLeaf,   // keccak256(abi.encode(fieldName, fieldValue))
    bytes32[]      calldata proof,
    uint256        leafIndex
) external view returns (bool) {
    Claim memory c = attestationRegistry.getClaim(claimId);
    require(!c.revoked && (c.expiresAt == 0 || block.timestamp < c.expiresAt), "Invalid claim");
    return MerkleProof.verify(proof, c.dataCommitment, fieldLeaf);
}
```

**Off-chain claim construction** (backend `claimEncoder.ts`):

```typescript
// backend/src/utils/merkleClaimBuilder.ts
import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { MerkleTree } from "merkletreejs";

export interface ClaimField { name: string; type: string; value: unknown }

export function buildClaimTree(fields: ClaimField[]): {
  root:   `0x${string}`;
  leaves: `0x${string}`[];
  tree:   MerkleTree;
} {
  const leaves = fields.map(f =>
    keccak256(encodeAbiParameters(
      parseAbiParameters("string, string, bytes32"),
      [f.name, f.type, keccak256(encodeAbiParameters(
        parseAbiParameters(f.type),
        [f.value as never]
      ))]
    ))
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return { root: `0x${tree.getHexRoot()}` as `0x${string}`, leaves, tree };
}

export function getFieldProof(tree: MerkleTree, leafIndex: number): `0x${string}`[] {
  return tree.getHexProof(tree.getLeaves()[leafIndex]) as `0x${string}`[];
}
```

The **raw field values are stored encrypted off-chain** (IPFS, encrypted with
the subject's public key). The subject controls the decryption key. Disclosure
flow: subject decrypts locally -> generates Merkle proof for the selected field
-> presents `(claimId, fieldLeaf, proof)` to the verifier -> verifier calls
`verifyField()` -> receives boolean result with zero knowledge of other fields.

---

#### Tier 2 — ZK-SNARK Selective Disclosure (V2 Roadmap)

Replace Merkle proofs with Groth16 or PLONK proofs so the verifier learns
nothing beyond the predicate result (e.g., "age >= 18" without learning the
actual age value).

**Toolchain decision**: Use **Circom + snarkjs** for circuit development.
The circuit proves: `hash(field_value) == leaf && MerkleProof(leaf, root) == true`
without revealing `field_value`.

**V2 storage migration path** (enabled by UUPS proxy from GAP 1):
- V2 adds a `bytes32 zkCommitment` field to `Claim` struct (new slot, appended)
- V2 adds `verifyZkField(bytes32 claimId, bytes calldata proof, uint256[] calldata publicSignals)` to `PassportVerifier`
- Existing Merkle-based claims remain valid — V2 is additive, not breaking

**Design rule for V1**: Every struct and interface decision made in V1 must be
evaluated for ZK compatibility. Specifically:
- Do not hash field data in a way that is incompatible with Poseidon hash (ZK-friendly)
- Use fixed-size field arrays where possible — dynamic arrays produce variable-length circuits
- Document in `docs/zk-readiness.md` which V1 data structures will need migration for ZK

---

### GAP 3 — Compliance and GDPR: Right-to-Erasure Architecture

**Problem**: ArcPass handles identity claims. Even if raw PII is stored off-chain,
the onchain `dataCommitment` (Merkle root) is a cryptographic fingerprint of
personal data. Under GDPR Article 17 (right to erasure), a subject may demand
deletion of their personal data. "It's on a blockchain, it's immutable" is not a
legally accepted response in any EU jurisdiction and increasingly not elsewhere.

**Architecture**: Separate the data layer from the commitment layer so erasure
is technically possible without rewriting blockchain history.

---

#### 3.1 Data Residency Model

```
Onchain (permanent, immutable):
  claimId, subject, schemaId, issuer, dataCommitment, issuedAt, expiresAt, revoked
  -> Contains zero raw PII. dataCommitment is a hash — not personal data under GDPR
     provided the pre-image (the actual field values) is deleted.

Off-chain (mutable, erasable):
  IPFS (Pinata): encrypted field values, metadata
  Backend DB:    decryption key references, claim field index
```

When a subject exercises right-to-erasure:
1. Backend deletes the encrypted field blob from IPFS (unpin + request deletion via Pinata API)
2. Backend deletes the decryption key from its database
3. The `dataCommitment` onchain becomes an orphaned hash — its pre-image is gone
4. `isValid()` still returns `true` (the claim record exists onchain)
5. `verifyField()` fails — no proof can be constructed without the field values

This is the correct outcome: the claim is cryptographically unverifiable (field
data is gone) while the audit trail (that a claim existed) is preserved. This
satisfies GDPR erasure without blockchain rewrite.

**Backend erasure endpoint**:

```typescript
// backend/src/routes/identity.ts
// DELETE /identity/:address/data — subject-initiated erasure
router.delete("/:address/data", requireSignedNonce, async (req, res) => {
  const subject = req.params.address;
  if (req.verifiedAddress.toLowerCase() !== subject.toLowerCase()) {
    return res.status(403).json({ success: false, error: { code: "NOT_SUBJECT" } });
  }

  const claims = await db.findClaimsBySubject(subject);
  for (const claim of claims) {
    await ipfsService.unpin(claim.ipfsCid);
    await db.deleteClaimData(claim.claimId);
    await db.recordErasure({ claimId: claim.claimId, subject, erasedAt: Date.now() });
  }

  return res.json({ success: true, data: { erased: claims.length } });
});
```

---

#### 3.2 Data Retention Policy

```typescript
// backend/src/config/retention.ts
export const RETENTION_POLICY = {
  // Claim field data: deleted on subject request OR 90 days after claim expiry
  claimDataAfterExpiry:  90 * 24 * 60 * 60 * 1000,

  // API request logs: anonymized after 30 days
  apiLogRetention:       30 * 24 * 60 * 60 * 1000,

  // Erasure audit records: kept for 7 years (legal obligation)
  erasureAuditRetention: 7 * 365 * 24 * 60 * 60 * 1000,
};
```

---

#### 3.3 Privacy by Design Rules (Mandatory for All Agents)

```
Rule 1: Never store raw PII in onchain calldata. Encode as a hash commitment
        or encrypt offchain before the commitment is built.

Rule 2: Never log wallet addresses alongside PII fields in the same log line.

Rule 3: Never return another subject's raw claim data from an API endpoint.
        Private fields require a subject-signed disclosure request.

Rule 4: The backend database is a PII custody layer. Treat it with the same
        security posture as a medical records database — encrypted at rest,
        access-logged.

Rule 5: Every field in a claim schema must be classified as:
        PUBLIC   -> may appear in GET /passport/:address response
        PRIVATE  -> disclosed only via subject-signed request + Merkle proof
        DERIVED  -> computed on-demand, never stored (e.g., age from DOB)
        Document in docs/claim-schemas.md for every schema version.
```

---

### GAP 4 — Gas Optimization and Scaling

**Problem**: No `foundry.toml` optimizer settings, no custom error definitions,
no batch operation design, no read-replica strategy. On Arc with USDC-denominated
gas, unoptimized contracts are a direct operating cost regression at scale.

---

#### 4.1 Foundry Optimizer Configuration

```toml
# contracts/foundry.toml
[profile.default]
src     = "src"
out     = "out"
libs    = ["lib"]
solc    = "0.8.24"
evm_version      = "prague"
optimizer        = true
optimizer_runs   = 200

[profile.high-call]
optimizer_runs   = 1000       # PassportVerifier — called millions of times

[profile.ci]
optimizer        = true
optimizer_runs   = 200
fuzz             = { runs = 10000 }
invariant        = { runs = 1000, depth = 50 }

[rpc_endpoints]
arc_testnet      = "${ARC_RPC_URL}"
```

---

#### 4.2 Custom Errors (Replace All String Reverts)

On Prague EVM, custom errors cost ~3x less gas than `require(condition, "string")`.
No `require` with a string message is permitted in any ArcPass contract.

```solidity
// contracts/src/core/errors/ArcPassErrors.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// AttestationRegistry
error ArcPass__NotIssuer(address caller);
error ArcPass__NotRevoker(address caller);
error ArcPass__ClaimNotFound(bytes32 claimId);
error ArcPass__ClaimAlreadyRevoked(bytes32 claimId);
error ArcPass__ActiveClaimExists(address subject, bytes32 schemaId, address issuer);
error ArcPass__ClaimExpired(bytes32 claimId, uint256 expiredAt);
error ArcPass__InvalidSubject();
error ArcPass__InvalidSchemaId();
error ArcPass__ZeroAddress();
error ArcPass__InvalidBatchSize(uint256 size);

// SchemaRegistry
error ArcPass__SchemaAlreadyExists(bytes32 schemaId);
error ArcPass__SchemaNotFound(bytes32 schemaId);
error ArcPass__EmptySchemaName();
error ArcPass__EmptyFieldsJson();

// PassportVerifier
error ArcPass__InvalidMerkleProof(bytes32 claimId, bytes32 fieldLeaf);
error ArcPass__VerificationFailed(address subject, bytes32 schemaId);

// Admin
error ArcPass__NotUpgrader(address caller);
error ArcPass__FeeTooHigh(uint256 fee, uint256 ceiling);
```

Gas benchmark targets — add `test/gas/GasBenchmark.t.sol` and run
`forge snapshot` before and after every contract change. A >5% regression
on any benchmarked function is a Warning that blocks merge.

---

#### 4.3 Batch Attestation

```solidity
// contracts/src/extensions/BatchAttestation.sol
struct AttestationInput {
    address subject;
    bytes32 schemaId;
    bytes32 dataCommitment;
    uint256 expiresAt;
}

/// @notice Issue up to 100 claims in one transaction.
/// @dev    Per-item try/catch — one failure does not revert the batch.
function batchAttest(AttestationInput[] calldata inputs)
    external
    onlyRole(ISSUER_ROLE)
    nonReentrant
    whenNotPaused
    returns (bytes32[] memory claimIds, bool[] memory successes)
{
    uint256 len = inputs.length;
    if (len == 0 || len > 100) revert ArcPass__InvalidBatchSize(len);
    claimIds  = new bytes32[](len);
    successes = new bool[](len);

    for (uint256 i; i < len; ) {
        try this._attestInternal(
            inputs[i].subject, inputs[i].schemaId,
            inputs[i].dataCommitment, inputs[i].expiresAt
        ) returns (bytes32 id) {
            claimIds[i]  = id;
            successes[i] = true;
        } catch {
            successes[i] = false;
        }
        unchecked { ++i; }
    }

    emit BatchIssued(len, msg.sender, block.timestamp);
}
```

Tester agent must produce a gas table in `test/gas/BatchGas.t.sol` for batch
sizes [1, 10, 25, 50, 100] and document cost-per-claim in `docs/gas-analysis.md`.

---

#### 4.4 Backend Read-Replica via Event Indexing

```typescript
// backend/src/indexer/claimIndexer.ts
export const startClaimIndexer = () =>
  publicClient.watchContractEvent({
    address:   ADDRESSES.attestationRegistry,
    abi:       ATTESTATION_REGISTRY_ABI,
    eventName: "ClaimIssued",
    onLogs: async (logs) => {
      for (const log of logs) {
        await db.upsertClaimIndex({
          claimId:  log.args.claimId!,
          subject:  log.args.subject!,
          schemaId: log.args.schemaId!,
          issuer:   log.args.issuer!,
          blockNum: log.blockNumber,
        });
      }
    },
  });
```

`GET /passport/:address` hits the local read model first (sub-ms), then
spot-checks `isValid()` onchain for the most recent claim only. Full onchain
rebuild triggers only on cache miss. Read model uses PostgreSQL — the query
pattern is relational (`WHERE subject = ? AND revoked = false ORDER BY issuedAt DESC`).

---

### GAP 5 — Error Handling: Custom Errors and Defensive TypeScript

**Problem**: No standardized error taxonomy for the backend or frontend. Silent
failures, raw hex revert data shown to users, and untraceable production bugs.

---

#### 5.1 Backend Error Taxonomy

```typescript
// backend/src/utils/errors.ts
export class ArcPassError extends Error {
  constructor(
    public readonly code:    string,
    public readonly message: string,
    public readonly status:  number = 500,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ArcPassError";
  }
}

export const Errors = {
  // Identity
  IdentityAlreadyRegistered: (address: string) =>
    new ArcPassError("IDENTITY_EXISTS",     `Identity already registered for ${address}`, 409),
  IdentityNotFound:          (address: string) =>
    new ArcPassError("IDENTITY_NOT_FOUND",  `No identity found for ${address}`, 404),

  // Attestation
  ClaimNotFound:           (claimId: string) =>
    new ArcPassError("CLAIM_NOT_FOUND",     `Claim ${claimId} not found`, 404),
  ClaimInvalid:            (claimId: string, reason: string) =>
    new ArcPassError("CLAIM_INVALID",       `Claim ${claimId} invalid: ${reason}`, 422),
  ActiveClaimExists:       (subject: string, schema: string) =>
    new ArcPassError("ACTIVE_CLAIM_EXISTS", `Subject ${subject} has active claim for ${schema}`, 409),

  // Auth
  InvalidSignature:        () =>
    new ArcPassError("INVALID_SIGNATURE",   "Signature verification failed", 401),
  NonceReused:             () =>
    new ArcPassError("NONCE_REUSED",        "Nonce already used", 401),
  NotIssuer:               (address: string) =>
    new ArcPassError("NOT_ISSUER",          `${address} does not hold ISSUER_ROLE`, 403),

  // Chain
  TransactionFailed:       (fn: string, reason: string) =>
    new ArcPassError("TX_FAILED",           `${fn} failed: ${reason}`, 502),
  ChainMismatch:           (expected: string, got: string) =>
    new ArcPassError("CHAIN_MISMATCH",      `Expected ${expected}, got ${got}`, 500),
  DecimalMismatch:         (context: string) =>
    new ArcPassError("DECIMAL_MISMATCH",    `USDC decimal error in ${context}`, 500),
} as const;
```

---

#### 5.2 Frontend — Custom Error Decoding

```typescript
// frontend/src/utils/parseContractError.ts
import { BaseError, ContractFunctionRevertedError } from "viem";

export function parseContractError(err: unknown): string {
  if (!(err instanceof BaseError)) return "Unknown error";

  const revert = err.walk(e => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError) {
    switch (revert.data?.errorName) {
      case "ArcPass__NotIssuer":           return "Your wallet does not have issuer permissions.";
      case "ArcPass__ClaimAlreadyRevoked": return "This claim has already been revoked.";
      case "ArcPass__ActiveClaimExists":   return "An active claim already exists. Revoke it first.";
      case "ArcPass__ClaimExpired":        return "This claim has expired.";
      case "ArcPass__SchemaAlreadyExists": return "This schema version is already registered.";
      case "ArcPass__InvalidMerkleProof":  return "Proof failed — field data may have been erased.";
      default: return revert.data?.errorName
        ? `Contract error: ${revert.data.errorName}`
        : "Transaction reverted.";
    }
  }

  return err instanceof BaseError ? (err.shortMessage ?? err.message) : "Unexpected error";
}
```

```tsx
// Usage — every useWriteContract call must include onError with parseContractError
const { writeContract } = useWriteContract({
  mutation: {
    onError: (err) => {
      toast.error(parseContractError(err));
      console.error("[tx error]", err);   // full error for devs only
    },
  },
});
```

React Error Boundary wrapping all passport routes:

```tsx
// frontend/src/components/shared/PassportErrorBoundary.tsx
export class PassportErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("[PassportErrorBoundary]", error); }

  render() {
    if (this.state.error) return (
      <div className="error-state">
        <p>Something went wrong loading this passport.</p>
        <button onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
    return this.props.children;
  }
}
```

---

*End of Senior Engineering Addendum — Five Production Gaps*
*These sections are binding. All agents enforce them with the same weight as §10–§15.*

---


> This file governs every AI agent (Architect, Implementer, Tester, Reviewer) operating
> inside this repository. Read it fully before touching any file. No agent may proceed
> without completing the READ → PLAN → WRITE → WIRE → VERIFY → REPORT protocol in §10.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Layout](#2-repository-layout)
3. [Tech Stack & Versions](#3-tech-stack--versions)
4. [Arc Network Configuration](#4-arc-network-configuration)
5. [Smart Contract Architecture](#5-smart-contract-architecture)
6. [Contract ABIs & Interface Patterns](#6-contract-abis--interface-patterns)
7. [Backend Architecture](#7-backend-architecture)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Environment Variables](#9-environment-variables)
10. [Agent Task Protocol](#10-agent-task-protocol)
11. [Agent Roles & Routing](#11-agent-roles--routing)
12. [Enforced Code Patterns](#12-enforced-code-patterns)
13. [Testing Standards](#13-testing-standards)
14. [Severity Classification](#14-severity-classification)

---

## 1. Project Overview

**ArcPass** is a decentralized onchain identity and attestation protocol built on
Arc L1 — a stablecoin-native EVM-compatible Layer-1 blockchain by Circle. It enables
any address to carry a verifiable, composable digital passport consisting of:

- A **primary identity** registered via ERC-8004 on Arc's native IdentityRegistry
- **Reputation events** accumulated via the ERC-8004 ReputationRegistry (anti-self-dealing enforced at protocol level)
- **Schema-based attestation claims** issued by trusted issuers via a custom `AttestationRegistry` contract
- A **passport verifier** contract that third-party dApps call to gate access by claim type
- An optional **privacy layer** designed for Arc's upcoming opt-in selective disclosure (TEE → ZK roadmap)

### Why Arc?

Arc provides capabilities unavailable on generic EVM chains:

- Native ERC-8004 identity and reputation contracts are already deployed on testnet
- USDC is the gas token — no volatile ETH exposure for protocol fees
- Sub-second deterministic finality — no waiting for confirmations before credential issuance
- Compliance tooling (Elliptic, TRM Labs) natively integrated for KYC-adjacent flows
- Chainlink, Pyth, RedStone, and Stork oracle support for offchain claim anchoring
- Prague EVM hard fork compatibility — full Solidity + Foundry + viem workflow

### Core user flows

```
1. Claim identity      → register() on IdentityRegistry → mint identity NFT → store IPFS metadata
2. Issue attestation   → trusted issuer calls attest()   → claim anchored onchain with schema hash
3. Earn reputation     → third-party validator calls recordEvent() on ReputationRegistry
4. Verify credential   → relying party calls verify()    → returns bool + expiry + issuer
5. Present passport    → frontend renders unified passport → QR proof export
6. Revoke / expire     → issuer calls revoke()            → claim marked invalid onchain
```

---

## 2. Repository Layout

```
arcpass/
├── AGENTS.md                          ← you are here
├── .env.example
├── .env                               ← never commit
│
├── contracts/                         ← all Solidity (Foundry project)
│   ├── foundry.toml
│   ├── remappings.txt
│   ├── src/
│   │   ├── core/
│   │   │   ├── AttestationRegistry.sol     ← custom claim issuance
│   │   │   ├── PassportVerifier.sol        ← gating / verification logic
│   │   │   ├── SchemaRegistry.sol          ← claim schema definitions
│   │   │   └── interfaces/
│   │   │       ├── IAttestationRegistry.sol
│   │   │       ├── IPassportVerifier.sol
│   │   │       ├── ISchemaRegistry.sol
│   │   │       ├── IERC8004IdentityRegistry.sol
│   │   │       └── IERC8004ReputationRegistry.sol
│   │   ├── extensions/
│   │   │   ├── DelegatedAttestation.sol    ← multi-issuer delegation
│   │   │   ├── ExpiringClaims.sol          ← TTL-based claim expiry
│   │   │   └── BatchAttestation.sol        ← gas-efficient bulk issuance
│   │   └── mocks/
│   │       ├── MockIssuer.sol
│   │       └── MockVerifier.sol
│   ├── test/
│   │   ├── AttestationRegistry.t.sol
│   │   ├── PassportVerifier.t.sol
│   │   ├── SchemaRegistry.t.sol
│   │   ├── DelegatedAttestation.t.sol
│   │   └── integration/
│   │       └── FullPassportFlow.t.sol
│   └── script/
│       ├── Deploy.s.sol
│       ├── RegisterIdentity.s.sol
│       └── SeedTestData.s.sol
│
├── backend/                           ← Node.js / Express API
│   ├── src/
│   │   ├── index.ts
│   │   ├── config/
│   │   │   ├── arc.ts                 ← chain config, RPC, contract addresses
│   │   │   └── circle.ts             ← Circle SDK init
│   │   ├── routes/
│   │   │   ├── identity.ts            ← POST /identity/register, GET /identity/:address
│   │   │   ├── attestation.ts         ← POST /attest, GET /claims/:address, DELETE /revoke
│   │   │   ├── reputation.ts          ← POST /reputation/record, GET /reputation/:address
│   │   │   ├── passport.ts            ← GET /passport/:address (aggregated view)
│   │   │   └── schema.ts             ← POST /schema/register, GET /schema/:id
│   │   ├── services/
│   │   │   ├── arcService.ts          ← viem publicClient + walletClient wrappers
│   │   │   ├── circleService.ts       ← Circle dev-controlled wallet interactions
│   │   │   ├── ipfsService.ts         ← Pinata IPFS upload/fetch
│   │   │   ├── identityService.ts     ← ERC-8004 IdentityRegistry interactions
│   │   │   ├── attestationService.ts  ← AttestationRegistry interactions
│   │   │   ├── reputationService.ts   ← ReputationRegistry interactions
│   │   │   └── passportService.ts     ← aggregate passport assembly
│   │   ├── middleware/
│   │   │   ├── auth.ts                ← JWT / wallet signature verification
│   │   │   ├── issuerGuard.ts         ← issuer allowlist enforcement
│   │   │   └── errorHandler.ts
│   │   └── utils/
│   │       ├── schemaHash.ts          ← deterministic schema hashing
│   │       ├── claimEncoder.ts        ← ABI-encode claim data
│   │       └── metadataBuilder.ts     ← IPFS metadata JSON builder
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                          ← React 19 + Vite
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── config/
│   │   │   └── wagmi.ts              ← Arc testnet chain definition + wagmi config
│   │   ├── contexts/
│   │   │   ├── PassportContext.tsx
│   │   │   └── WalletContext.tsx
│   │   ├── hooks/
│   │   │   ├── useIdentity.ts         ← register / fetch ERC-8004 identity
│   │   │   ├── useAttestation.ts      ← issue / fetch / verify claims
│   │   │   ├── useReputation.ts       ← fetch reputation score
│   │   │   ├── usePassport.ts         ← aggregated passport hook
│   │   │   └── useArcContract.ts      ← generic typed contract read/write hook
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Register.tsx           ← identity registration flow
│   │   │   ├── Passport.tsx           ← passport display + QR export
│   │   │   ├── Issuer.tsx             ← issuer dashboard: attest / revoke
│   │   │   └── Verify.tsx             ← relying party verifier
│   │   ├── components/
│   │   │   ├── passport/
│   │   │   │   ├── PassportCard.tsx
│   │   │   │   ├── ClaimBadge.tsx
│   │   │   │   └── ReputationMeter.tsx
│   │   │   ├── forms/
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   ├── AttestForm.tsx
│   │   │   │   └── VerifyForm.tsx
│   │   │   └── shared/
│   │   │       ├── TxStatus.tsx       ← transaction confirmation tracker
│   │   │       ├── WalletButton.tsx
│   │   │       └── AddressDisplay.tsx
│   │   └── types/
│   │       ├── identity.ts
│   │       ├── attestation.ts
│   │       └── passport.ts
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
└── docs/
    ├── architecture.md
    ├── claim-schemas.md
    └── issuer-guide.md
```

---

## 3. Tech Stack & Versions

### Smart Contracts
| Tool | Version | Notes |
|------|---------|-------|
| Solidity | `^0.8.24` | Prague EVM target |
| Foundry (forge) | latest stable | build, test, deploy |
| OpenZeppelin Contracts | `^5.0.0` | AccessControl, ERC721, Pausable |
| viem | `^2.x` | script interactions |

### Backend
| Tool | Version | Notes |
|------|---------|-------|
| Node.js | `>=20` | ESM modules |
| TypeScript | `^5.x` | strict mode |
| Express | `^4.x` | REST API |
| viem | `^2.x` | Arc chain client |
| @circle-fin/developer-controlled-wallets | latest | Circle wallet SDK |
| Pinata SDK | latest | IPFS pinning |
| tsx | latest | dev runner |
| Zod | `^3.x` | runtime schema validation |

### Frontend
| Tool | Version | Notes |
|------|---------|-------|
| React | `19.x` | |
| Vite | `^5.x` | |
| TypeScript | `^5.x` | strict mode |
| wagmi | `^2.x` | wallet connection |
| viem | `^2.x` | contract reads/writes |
| TanStack Query | `^5.x` | data fetching |
| Tailwind CSS | `^3.x` | styling |
| qrcode.react | latest | QR passport export |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Arc Testnet | L1 execution (mainnet pending) |
| Circle Developer Console | API keys + dev-controlled wallets |
| Pinata | IPFS metadata pinning |
| Chainlink | Price feeds (if claim value anchoring needed) |
| Testnet arcscan | `https://testnet.arcscan.app` |

---

## 4. Arc Network Configuration

### Chain parameters (Arc Testnet)

```typescript
// frontend/src/config/wagmi.ts and backend/src/config/arc.ts — use this exact config

export const arcTestnet = {
  id: 5042002,                            // Arc Testnet chain ID
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,                        // native gas uses 18 decimals; ERC-20 interface uses 6
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
} as const;
```

### Critical decimal rule

Arc USDC has two interfaces sharing a single balance:

- **Native gas token**: 18 decimals — used in `value` fields, gas accounting
- **ERC-20 interface**: 6 decimals — use this for ALL application-level token amounts

**Agents must never mix raw values between these two interfaces.** Always use
`parseUnits(amount, 6)` for ERC-20 USDC amounts. Never call `parseEther()` for USDC.

### Finality

Arc reaches deterministic finality in under 1 second. After a transaction is
included in a block it **cannot be reversed**. This means:

- No need to wait for multiple confirmations
- Offchain systems may act on events after a single confirmation
- Do not implement confirmation-count polling — use `waitForTransactionReceipt` once

### PREV_RANDAO / randomness

`block.prevrandao` is always `0` on Arc. Never use it as a randomness source in
contracts. Use Chainlink VRF or a commit-reveal scheme if randomness is required.

---

## 5. Smart Contract Architecture

### Arc native registry addresses (Testnet)

These are deployed and immutable — never redeploy them, only integrate against them.

```solidity
// Arc ERC-8004 Identity contracts
address constant IDENTITY_REGISTRY   = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
address constant REPUTATION_REGISTRY = 0x8004B663056A597Dffe9eCcC1965A193B7388713;
address constant VALIDATION_REGISTRY = 0x8004Cb1BF31DAf7788923b405b754f57acEB4272;

// Arc stablecoin addresses
address constant USDC_ERC20          = 0x3600000000000000000000000000000000000000; // 6 decimals
address constant EURC                = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;

// Circle crosschain (CCTP v2)
address constant TOKEN_MESSENGER_V2  = 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA;
address constant MSG_TRANSMITTER_V2  = 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275;
```

### ArcPass custom contracts (to be deployed)

#### `SchemaRegistry.sol`

Stores claim schema definitions identified by a deterministic `bytes32 schemaId`.
Schemas define the shape of a claim (field names, types, version). Any address
may register a schema; registered schemas are immutable.

```solidity
struct Schema {
    bytes32 schemaId;       // keccak256(abi.encode(name, version, fields))
    string  name;
    string  version;
    string  fieldsJson;     // JSON-encoded field definitions
    address registrant;
    uint256 registeredAt;
}

function registerSchema(
    string calldata name,
    string calldata version,
    string calldata fieldsJson
) external returns (bytes32 schemaId);

function getSchema(bytes32 schemaId) external view returns (Schema memory);
```

#### `AttestationRegistry.sol`

The core credential store. Only allowlisted issuers may call `attest()`. Claims
are keyed by `(subject, schemaId, issuer)` to prevent duplicate issuance from
the same issuer. Revocation sets `revoked = true` but does not delete the record
(audit trail preservation).

```solidity
struct Claim {
    bytes32   claimId;      // keccak256(abi.encode(subject, schemaId, issuer, issuedAt))
    address   subject;
    bytes32   schemaId;
    address   issuer;
    bytes     data;         // ABI-encoded claim payload (schema-defined)
    uint256   issuedAt;
    uint256   expiresAt;    // 0 = no expiry
    bool      revoked;
}

function attest(
    address   subject,
    bytes32   schemaId,
    bytes     calldata data,
    uint256   expiresAt
) external returns (bytes32 claimId);

function revoke(bytes32 claimId) external;

function getClaim(bytes32 claimId) external view returns (Claim memory);

function getActiveClaims(
    address subject,
    bytes32 schemaId
) external view returns (bytes32[] memory claimIds);

function isValid(bytes32 claimId) external view returns (bool);
```

**Access control**: `AttestationRegistry` uses OpenZeppelin `AccessControl`.
The `ISSUER_ROLE` is required to call `attest()`. The `DEFAULT_ADMIN_ROLE`
manages issuer enrollment. The contract deployer receives `DEFAULT_ADMIN_ROLE`.

#### `PassportVerifier.sol`

Stateless verification contract. Relying parties call `verify()` with a subject
address and required schema to get a boolean result plus metadata. This contract
reads from `AttestationRegistry` and performs no state writes — it is safe to
call without gas if interacting via `eth_call`.

```solidity
struct VerificationResult {
    bool      valid;
    bytes32   claimId;
    address   issuer;
    uint256   issuedAt;
    uint256   expiresAt;
    bytes     data;
}

function verify(
    address subject,
    bytes32 schemaId
) external view returns (VerificationResult memory result);

function verifyMulti(
    address          subject,
    bytes32[] calldata schemaIds
) external view returns (VerificationResult[] memory results);
```

### ERC-8004 integration pattern

ArcPass does **not** redeploy the ERC-8004 contracts. It calls them directly.
The backend `identityService.ts` wraps the contract calls. The relevant ERC-8004
function signatures are:

```solidity
// IERC8004IdentityRegistry
function register(string calldata metadataURI) external returns (uint256 tokenId);
function getIdentity(address owner) external view returns (uint256 tokenId, string memory metadataURI);
function ownerOf(uint256 tokenId) external view returns (address);

// IERC8004ReputationRegistry
// Note: agent owners CANNOT record reputation for their own agents (anti-self-dealing)
function recordEvent(
    uint256   identityTokenId,
    string    calldata eventType,
    string    calldata metadataURI
) external returns (uint256 eventId);

function getEvents(uint256 identityTokenId) external view returns (uint256[] memory eventIds);
```

---

## 6. Contract ABIs & Interface Patterns

### Encoding claim data

Claim `data` in `AttestationRegistry` is ABI-encoded. The schema's `fieldsJson`
defines the types. Use `abi.encode` in Solidity and `encodeAbiParameters` in viem.

Example: a KYC-level claim with schema `{ level: uint8, country: string, provider: address }`:

```typescript
// backend/src/utils/claimEncoder.ts
import { encodeAbiParameters, parseAbiParameters } from "viem";

export function encodeKycClaim(level: number, country: string, provider: `0x${string}`) {
  return encodeAbiParameters(
    parseAbiParameters("uint8 level, string country, address provider"),
    [level, country, provider]
  );
}
```

Decoding on read uses the same parameter spec with `decodeAbiParameters`.

### Reading contracts via viem (backend)

```typescript
// backend/src/services/arcService.ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../config/arc";

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.ARC_RPC_URL),
});

// For server-side write operations use Circle dev-controlled wallets, not a raw private key.
// Only use walletClient directly for deployment scripts in /contracts/script/
```

### Reading contracts via wagmi (frontend)

```typescript
// frontend/src/hooks/useArcContract.ts
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry";
import { ATTESTATION_REGISTRY_ADDRESS } from "../config/addresses";

export function useVerifyClaim(subject: `0x${string}`, schemaId: `0x${string}`) {
  return useReadContract({
    address: ATTESTATION_REGISTRY_ADDRESS,
    abi: ATTESTATION_REGISTRY_ABI,
    functionName: "isValid",
    args: [schemaId],                    // NOTE: claimId, not schemaId — adjust per call
  });
}
```

All contract ABIs live in `frontend/src/abis/` and `backend/src/abis/` as typed
TypeScript const arrays. Never inline ABI fragments in component or service files.

---

## 7. Backend Architecture

### Circle dev-controlled wallets

The backend uses Circle Developer-Controlled Wallets for all server-initiated
transactions (identity registration, attestation issuance, reputation recording).
This avoids exposing any raw private key on the server.

```typescript
// backend/src/config/circle.ts
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});
```

When making a contract call through Circle:

```typescript
// backend/src/services/attestationService.ts (pattern)
async function issueAttestation(
  walletId: string,
  subject: string,
  schemaId: string,
  encodedData: string,
  expiresAt: number
) {
  const tx = await circleClient.createContractExecutionTransaction({
    walletId,
    blockchain: "ARC-TESTNET",
    contractAddress: process.env.ATTESTATION_REGISTRY_ADDRESS!,
    abiFunctionSignature: "attest(address,bytes32,bytes,uint256)",
    abiParameters: [subject, schemaId, encodedData, expiresAt.toString()],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  // Poll for COMPLETE — Arc finalizes in <1s so this loop is short
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const { data } = await circleClient.getTransaction({ id: tx.data!.id! });
    if (data?.transaction?.state === "COMPLETE") return data.transaction.txHash;
    if (data?.transaction?.state === "FAILED") throw new Error("Transaction failed");
  }
  throw new Error("Transaction timed out");
}
```

### IPFS metadata structure

All identity and attestation metadata stored on IPFS must follow this shape:

```json
// Identity metadata (ERC-8004)
{
  "arcpass_version": "1.0",
  "type": "identity",
  "name": "Human-readable display name",
  "description": "Optional bio",
  "image": "ipfs://QmAvatarHash...",
  "created_at": "2026-01-01T00:00:00Z",
  "attributes": []
}

// Attestation metadata (supplementary — claimId is the canonical identifier)
{
  "arcpass_version": "1.0",
  "type": "attestation",
  "claimId": "0x...",
  "schemaId": "0x...",
  "schemaName": "kyc_basic",
  "issuedAt": 1700000000,
  "expiresAt": 1800000000,
  "publicFields": {
    "level": 2,
    "country": "ET"
  }
}
```

### API route patterns

All routes follow REST conventions. Response envelopes:

```typescript
// Success
{ success: true, data: <payload> }

// Error
{ success: false, error: { code: string, message: string } }
```

Route definitions live in `backend/src/routes/`. Each route file:
- Imports its own Zod schema for request validation
- Calls a service function (never direct contract calls from routes)
- Returns a typed response envelope

Route guard `issuerGuard.ts` verifies the caller's address holds `ISSUER_ROLE`
before passing to attestation write endpoints. It does this by calling
`hasRole(ISSUER_ROLE, callerAddress)` on the `AttestationRegistry`.

### Aggregated passport endpoint

`GET /passport/:address` assembles the full passport by:
1. Calling `identityService.getIdentity(address)` → ERC-8004 token + IPFS metadata
2. Calling `reputationService.getEvents(tokenId)` → reputation event list
3. Calling `attestationService.getActiveClaims(address, null)` → all schemas
4. Merging and returning a `PassportDocument` type

```typescript
// backend/src/types/passport.ts
export interface PassportDocument {
  address:     string;
  identityId:  number;           // ERC-8004 token ID
  metadataUri: string;
  metadata:    IdentityMetadata;
  reputation:  ReputationEvent[];
  claims:      ActiveClaim[];
  generatedAt: number;
}
```

---

## 8. Frontend Architecture

### Wagmi chain configuration

```typescript
// frontend/src/config/wagmi.ts
import { createConfig, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import { arcTestnet } from "./chains";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [arcTestnet.id]: http(import.meta.env.VITE_ARC_RPC_URL),
  },
});
```

### State management rules

- Global wallet state: `WalletContext` using `useAccount`, `useChainId`, `useConnect`
- Passport data: `PassportContext` — fetched once per address, cached via TanStack Query
- Transaction states: local `useState` in the component initiating the tx, using `useWriteContract` + `useWaitForTransactionReceipt`
- Do **not** use Redux or Zustand — context + TanStack Query is sufficient

### Transaction confirmation pattern

Arc finalizes in <1s. The `TxStatus` component handles the wait state:

```typescript
// frontend/src/components/shared/TxStatus.tsx (usage pattern)
const { writeContract, data: txHash } = useWriteContract();
const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

// isLoading will be true for roughly <1s on Arc
// Do NOT implement a "waiting for confirmations" countdown — it's instant
```

### Passport display

`PassportCard.tsx` renders the full passport. It accepts a `PassportDocument`
prop and renders:
- Address + identity NFT token ID
- Avatar image (from IPFS metadata, with fallback)
- Active claims as `ClaimBadge` components (schema name + issuer + expiry)
- `ReputationMeter` showing event count and types
- QR code export button (encodes passport URL + address)

`ClaimBadge` color codes by claim type:
- Identity verification: blue
- Professional credential: purple
- KYC / compliance: green
- Custom / unknown schema: gray

### Page routing

```
/                  → Home: connect wallet, explain protocol
/register          → RegisterForm: identity registration flow
/passport/:address → Passport: view any address's passport
/issue             → Issuer dashboard (ISSUER_ROLE guard on frontend AND backend)
/verify            → Verify: paste address + select schema → result
```

Frontend guards: if `useAccount().isConnected === false`, redirect to `/`.
If route requires issuer role, call `/api/issuer/check` before rendering.

---

## 9. Environment Variables

### Backend `.env`

```bash
# Arc network
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002

# Circle SDK
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_ISSUER_WALLET_ID=      # wallet ID for server-initiated attestations

# Deployed contract addresses (populated after Deploy.s.sol)
ATTESTATION_REGISTRY_ADDRESS=
SCHEMA_REGISTRY_ADDRESS=
PASSPORT_VERIFIER_ADDRESS=

# IPFS
PINATA_API_KEY=
PINATA_SECRET_KEY=

# App
PORT=3001
JWT_SECRET=
NODE_ENV=development
```

### Frontend `.env`

```bash
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_ATTESTATION_REGISTRY_ADDRESS=
VITE_SCHEMA_REGISTRY_ADDRESS=
VITE_PASSPORT_VERIFIER_ADDRESS=
VITE_IDENTITY_REGISTRY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
VITE_REPUTATION_REGISTRY_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713
VITE_API_BASE_URL=http://localhost:3001
```

### Foundry `.env` (contracts/.env)

```bash
ARC_RPC_URL=https://rpc.testnet.arc.network
DEPLOYER_PRIVATE_KEY=         # testnet only — never use a funded mainnet key here
ETHERSCAN_API_KEY=            # arcscan verification key if available
```

**Agents must never write `.env` values into source files.** Use `process.env`
in Node, `import.meta.env` in Vite, and Foundry `vm.envAddress()` / `vm.envUint()`
in scripts. If a value is missing, throw a descriptive error at startup, not at
call-time.

---

## 10. Agent Task Protocol

Every agent — without exception — must follow this six-step protocol before
producing any output. Skipping or condensing steps is a **Critical** violation.

```
READ → PLAN → WRITE → WIRE → VERIFY → REPORT
```

### STEP 1 — READ

Before writing a single line of code or config:

1. Read this entire `AGENTS.md` file
2. Read every file in the task's scope (the files you will modify or that your
   changes depend on)
3. Read the relevant Arc docs sections linked in §4–§5 if the task touches
   contract addresses, ERC-8004 interfaces, or USDC decimal handling
4. Identify which contracts, services, and routes are involved
5. Check for existing patterns — do not invent new conventions when one already exists

### STEP 2 — PLAN

Output a plain-language plan before writing code:

```
Task: <one sentence description>
Files touched: <list>
Contracts involved: <list with addresses>
Arc-specific concerns: <decimal handling / finality / ERC-8004 quirks>
Steps:
  1. ...
  2. ...
Risks: <what could go wrong>
```

Wait for explicit approval of the plan before proceeding to WRITE if the task
is non-trivial (more than one file changed, any contract interaction added).

### STEP 3 — WRITE

- Write the minimum code necessary to satisfy the task
- Match existing file conventions exactly (imports order, export style, naming)
- No `console.log` left in production paths — use a logger if debugging is needed
- No hardcoded addresses in application code — always read from env/config
- Every new function needs a JSDoc / NatSpec comment stating what it does and why

### STEP 4 — WIRE

Connect the new code:
- Export from index files if needed
- Register new routes in `backend/src/index.ts`
- Add new ABIs to both `frontend/src/abis/` and `backend/src/abis/`
- Add new env vars to `.env.example` with a comment explaining their purpose
- If a new contract was written, add its address constant to `contracts/src/core/interfaces/`

### STEP 5 — VERIFY

Before reporting done:

- Run `forge build` — must pass with zero errors
- Run `forge test` — all existing tests must still pass; new tests for new code
- Run `tsc --noEmit` in both `backend/` and `frontend/`
- Confirm no hardcoded addresses or secrets are present
- Confirm USDC decimals are correct (6 for ERC-20, 18 for native) in every usage
- Confirm any new `attest()` / `revoke()` calls go through Circle wallets, not raw keys
- Confirm `waitForTransactionReceipt` is used (not confirmation polling) for all tx waits

### STEP 6 — REPORT

Output a summary:

```
Status: COMPLETE | BLOCKED | PARTIAL
Files changed: <list with one-line description of each change>
Tests: <X new tests added, all Y existing pass>
Warnings: <any non-critical issues noted>
Next: <what the next agent should do, if known>
```

---

## 11. Agent Roles & Routing

This project uses four specialized agents. OpenCode / agentic tools should route
tasks to the correct agent based on these descriptions.

### Architect (Qwen3 / planning model)

**Owns**: system design decisions, contract interface design, data model changes,
cross-cutting concerns, dependency choices, migration plans.

**Triggers**: any task that involves adding a new contract, changing an existing
interface, adding a new service layer, or changing how Arc contracts are integrated.

**Does not**: write implementation code, run tests, modify individual files.

**Output format**: PLAN document (see §10 STEP 2 format), updated AGENTS.md
sections, architecture diagrams in `docs/`.

### Implementer (Claude Sonnet / coding model)

**Owns**: all implementation code — Solidity contracts, TypeScript services,
routes, hooks, components, deployment scripts.

**Triggers**: any task with a clear plan that requires producing or modifying code.

**Does not**: make architectural decisions without an approved PLAN from Architect.
Does not modify test files unless the task is specifically "fix these tests".

**File boundary rules**:
- May create new files only within the existing directory structure
- Must not move or delete files without an approved PLAN
- Must not add new npm/forge dependencies without noting them in the PLAN

### Tester (Gemini 2.5 Pro / verification model)

**Owns**: all test files under `contracts/test/`, integration test scenarios,
assertion quality, edge case identification.

**Triggers**: any time new contracts or services are written or changed, and
at every STEP 5 verification pass.

**Required test coverage per contract**:
- Happy path: successful call returns expected state
- Access control: unauthorized caller reverts with correct error
- Edge cases: zero address, expired claims, already-revoked claims, duplicate attestations
- Arc-specific: decimal handling correctness, re-entrancy (if applicable)

**Foundry test patterns**:

```solidity
// contracts/test/AttestationRegistry.t.sol (pattern)
contract AttestationRegistryTest is Test {
    AttestationRegistry registry;
    address issuer  = makeAddr("issuer");
    address subject = makeAddr("subject");
    bytes32 schemaId;

    function setUp() public {
        registry = new AttestationRegistry();
        registry.grantRole(registry.ISSUER_ROLE(), issuer);
        schemaId = keccak256("test_schema_v1");
    }

    function test_attest_success() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, "", 0);
        assertTrue(registry.isValid(claimId));
    }

    function test_attest_revertsIfNotIssuer() public {
        vm.prank(subject);              // subject does not have ISSUER_ROLE
        vm.expectRevert();
        registry.attest(subject, schemaId, "", 0);
    }

    function test_revoke_invalidatesClaim() public {
        vm.prank(issuer);
        bytes32 claimId = registry.attest(subject, schemaId, "", 0);
        vm.prank(issuer);
        registry.revoke(claimId);
        assertFalse(registry.isValid(claimId));
    }

    function test_expiredClaimIsInvalid() public {
        vm.prank(issuer);
        uint256 expiry = block.timestamp + 1;
        bytes32 claimId = registry.attest(subject, schemaId, "", expiry);
        vm.warp(block.timestamp + 2);  // advance past expiry
        assertFalse(registry.isValid(claimId));
    }
}
```

### Reviewer (o3 / audit model)

**Owns**: final code review before any PR merge, severity classification of issues,
security audit pass on all contract code.

**Triggers**: when Implementer reports COMPLETE on any task touching contracts
or Circle wallet interactions.

**Review checklist** (must pass before approving):

- [ ] No raw private keys in any non-script file
- [ ] Access control roles are correct and tested
- [ ] USDC decimals are correctly applied (6 vs 18)
- [ ] `attest()` and `revoke()` are gated by `ISSUER_ROLE`
- [ ] No `SELFDESTRUCT` in contracts (blocked on Arc)
- [ ] No `block.prevrandao` usage (always 0 on Arc)
- [ ] `waitForTransactionReceipt` pattern used correctly (single confirmation)
- [ ] No addresses hardcoded outside of config/constant files
- [ ] Circle wallet transaction polling uses the correct `COMPLETE`/`FAILED` state names
- [ ] Claim `data` encoding/decoding is symmetric (encode on write, decode on read, same ABI types)
- [ ] IPFS metadata conforms to the schema in §7
- [ ] All new public functions have NatSpec comments

---

## 12. Enforced Code Patterns

### Pattern A — Contract address management

Addresses never appear inline. They live in exactly two places:

1. `contracts/src/core/interfaces/` as Solidity constants
2. `backend/src/config/arc.ts` and `frontend/src/config/addresses.ts` reading from env

```typescript
// frontend/src/config/addresses.ts
export const ADDRESSES = {
  identityRegistry:   import.meta.env.VITE_IDENTITY_REGISTRY_ADDRESS   as `0x${string}`,
  reputationRegistry: import.meta.env.VITE_REPUTATION_REGISTRY_ADDRESS as `0x${string}`,
  attestationRegistry: import.meta.env.VITE_ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
  schemaRegistry:      import.meta.env.VITE_SCHEMA_REGISTRY_ADDRESS     as `0x${string}`,
  passportVerifier:    import.meta.env.VITE_PASSPORT_VERIFIER_ADDRESS   as `0x${string}`,
} as const;
```

### Pattern B — Transaction submission (backend)

All backend contract writes go through `circleService.ts`. No raw `walletClient.writeContract`
calls in service files — those are only acceptable in Foundry deploy scripts.

```typescript
// CORRECT — backend service calling Circle SDK
const txHash = await attestationService.issueAttestation(
  process.env.CIRCLE_ISSUER_WALLET_ID!,
  subject, schemaId, encodedData, expiresAt
);

// INCORRECT — never do this in backend services
const hash = await walletClient.writeContract({ ... });
```

### Pattern C — Frontend write calls

Frontend uses `useWriteContract` + `useWaitForTransactionReceipt` from wagmi.
Never call `publicClient.simulateContract` manually unless implementing a
custom gas estimator.

```typescript
// CORRECT — wagmi hooks
const { writeContract, data: hash, isPending } = useWriteContract();
const { isSuccess } = useWaitForTransactionReceipt({ hash });

// INCORRECT — do not use ethers.js in the frontend
```

### Pattern D — Error handling

All errors thrown from services must include the originating contract address
and function name:

```typescript
throw new Error(
  `AttestationRegistry.attest() failed for subject ${subject}: ${err.message}`
);
```

Frontend catch blocks must not silently swallow errors. Every `try/catch` in a
component must either set an error state or call a toast/notification.

### Pattern E — Schema ID computation

Schema IDs are computed deterministically to ensure consistency between on- and
offchain:

```typescript
// backend/src/utils/schemaHash.ts
import { keccak256, encodePacked } from "viem";

export function computeSchemaId(name: string, version: string, fieldsJson: string): `0x${string}` {
  return keccak256(encodePacked(["string", "string", "string"], [name, version, fieldsJson]));
}
```

The same computation must be used in `SchemaRegistry.sol`:

```solidity
function registerSchema(...) external returns (bytes32 schemaId) {
    schemaId = keccak256(abi.encodePacked(name, version, fieldsJson));
    // ...
}
```

### Pattern F — Issuer role guard (backend middleware)

```typescript
// backend/src/middleware/issuerGuard.ts
import { publicClient } from "../services/arcService";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry";
import { ADDRESSES } from "../config/arc";

export async function issuerGuard(req, res, next) {
  const caller = req.headers["x-wallet-address"] as `0x${string}`;
  if (!caller) return res.status(401).json({ success: false, error: { code: "NO_ADDRESS" } });

  const ISSUER_ROLE = await publicClient.readContract({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_REGISTRY_ABI,
    functionName: "ISSUER_ROLE",
  });

  const hasRole = await publicClient.readContract({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_REGISTRY_ABI,
    functionName: "hasRole",
    args: [ISSUER_ROLE, caller],
  });

  if (!hasRole) return res.status(403).json({ success: false, error: { code: "NOT_ISSUER" } });
  next();
}
```

---

## 13. Testing Standards

### Foundry tests

- Every public/external contract function needs at least one test
- Every `require`/`revert` path needs a corresponding `vm.expectRevert()` test
- Use `makeAddr("name")` for test addresses — never hardcode real addresses in tests
- Use `vm.prank(addr)` for access control tests
- Use `vm.warp(timestamp)` for expiry / time-dependent tests
- Integration test `FullPassportFlow.t.sol` must simulate the complete user journey:
  register identity → register schema → issue attestation → verify → revoke → verify (false)

### TypeScript tests (backend)

- Use Vitest (install as dev dependency)
- Services that call Circle SDK or viem are tested with mocks
- Integration tests in `backend/src/__tests__/integration/` spin up a local Anvil fork of Arc testnet

### TypeScript tests (frontend)

- Use Vitest + React Testing Library
- Hooks tested with `renderHook`
- Contract reads mocked via wagmi test utilities
- Passport rendering tested with snapshot tests

### Test naming convention

```
test_<functionName>_<scenario>          // Solidity (snake_case)
describe("<FunctionName>")              // TypeScript
  it("should <scenario>")
```

---

## 14. Severity Classification

Agents use this classification in REPORT outputs and Reviewer uses it in review
responses. All **Critical** issues block merge. All **Warning** issues must be
resolved or explicitly waived with written justification.

### Critical (blocks merge, must fix before COMPLETE)

- Raw private key or secret in any committed file
- Hardcoded contract address outside config/constants
- Missing access control on `attest()` or `revoke()`
- USDC decimal mismatch (18 vs 6) in any value calculation
- Contract uses `block.prevrandao` as randomness source
- `SELFDESTRUCT` used in any deployed contract
- Transaction polling uses wrong state string (e.g. `"COMPLETED"` instead of `"COMPLETE"`)
- Circle wallet ID missing from env, causing silent failures
- IPFS upload not awaited before passing URI to contract call
- Frontend write call bypasses `useWaitForTransactionReceipt`

### Warning (must resolve or justify)

- Missing NatSpec on a public contract function
- Missing JSDoc on a service function
- New npm dependency not recorded in PLAN before installation
- `console.log` left in non-test code
- Claim `data` decoded without null check on empty bytes
- Frontend displays raw `0x...` claim ID without truncation
- No loading state shown during tx submission (Arc is fast but not instant)
- Schema ID computed differently onchain vs offchain (desync risk)
- Test file added without corresponding entry in `contracts/test/` directory

### Info (note in REPORT, no action required)

- Code style inconsistency that doesn't affect correctness
- Comment that could be clearer
- Opportunity to use a more idiomatic wagmi/viem pattern
- Suboptimal gas usage in non-critical path

---

*End of AGENTS.md — ArcPass v1.0*
*Last updated: May 2026*
*Maintained by: Joshua (King 👑)*

---

## 15. Security Threat Model & Guardrails

> This section is **mandatory reading** for the Reviewer agent before approving any PR,
> and for the Implementer before touching any contract, service, or auth middleware.
> Every attack vector below has killed real protocols. ArcPass deals with identity
> and attestations — claims that gate real-world access. The blast radius of a
> compromise here is not financial loss alone; it is identity fraud at scale.

---

### 15.1 Threat Landscape Overview

The 2024–2025 onchain security record is clear: access control failures account
for the dominant share of losses, the average hack now costs $25M in direct theft
plus 61% token value destruction, and over 90% of deployed protocols still carry
critical exploitable vulnerabilities. The attack surface for ArcPass specifically
spans six distinct layers. Every layer must be defended independently — a hardened
contract with a leaky backend is still a dead protocol.

```
LAYER 1  Smart contract logic         (AttestationRegistry, PassportVerifier, SchemaRegistry)
LAYER 2  Arc / EVM quirks             (USDC decimals, finality, prevrandao, USDC blocklist)
LAYER 3  Circle SDK & key management  (Entity Secret, API key, wallet ID)
LAYER 4  Backend API                  (auth, issuer guards, IPFS, rate limiting)
LAYER 5  Frontend / wallet            (transaction simulation, signing phishing, CSP)
LAYER 6  Human / operational          (key ceremonies, CI/CD secrets, social engineering)
```

---

### 15.2 Layer 1 — Smart Contract Attack Vectors

#### 15.2.1 Access Control Exploitation

**Attack**: Attacker calls `attest()` or `revoke()` without holding `ISSUER_ROLE`,
either because the role check is missing, miscoded, or the `DEFAULT_ADMIN_ROLE`
was mistakenly left open to the public.

**Historical precedent**: Poly Network ($611M, 2021) — privilege escalation via
missing validation on cross-chain message handler. Access control failures are the
#1 cause of smart contract losses industry-wide.

**Guardrail — contract**:
```solidity
// AttestationRegistry.sol
bytes32 public constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");  // separate revoke permission

function attest(
    address subject,
    bytes32 schemaId,
    bytes   calldata data,
    uint256 expiresAt
) external onlyRole(ISSUER_ROLE) returns (bytes32 claimId) {
    // ...
}

function revoke(bytes32 claimId) external onlyRole(REVOKER_ROLE) {
    require(!claims[claimId].revoked, "Already revoked");
    claims[claimId].revoked = true;
    emit ClaimRevoked(claimId, msg.sender, block.timestamp);
}
```

**Guardrail — deployment**: The deployer renounces `DEFAULT_ADMIN_ROLE` after
granting roles to a dedicated multisig. No EOA should hold `DEFAULT_ADMIN_ROLE`
in production. Use a 3-of-5 Gnosis Safe or equivalent.

```solidity
// Deploy.s.sol — after granting roles to multisig:
registry.renounceRole(registry.DEFAULT_ADMIN_ROLE(), deployer);
```

**Test requirement**: Every role-gated function must have a `test_*_revertsIfNotRole`
test that calls it from an address without the role and expects revert.

---

#### 15.2.2 Reentrancy on Claim Issuance

**Attack**: An attacker deploys a malicious contract as `subject`. When `attest()`
emits an event or makes an external callback, the malicious contract re-enters
`attest()` and registers duplicate claims before state is updated.

**Guardrail**:
```solidity
// Use OpenZeppelin ReentrancyGuard on all state-mutating functions
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AttestationRegistry is AccessControl, ReentrancyGuard, Pausable {
    function attest(...) external onlyRole(ISSUER_ROLE) nonReentrant returns (bytes32) {
        // checks-effects-interactions: update state BEFORE any external calls
        bytes32 claimId = _computeClaimId(subject, schemaId, msg.sender);
        claims[claimId] = Claim({ ... });           // state updated first
        emit ClaimIssued(claimId, subject, msg.sender, schemaId);  // emit after
        // no external calls to subject — never call back into subject
        return claimId;
    }
}
```

**Rule**: `AttestationRegistry` must never call back into the `subject` address.
No hooks, no ERC-721 `onERC721Received`-style callbacks on subject. If a
notification pattern is needed in future, use pull-over-push (subject reads its
own claims).

---

#### 15.2.3 Duplicate / Conflicting Attestation

**Attack**: The same issuer issues two conflicting claims to the same subject
under the same schema (e.g., `KYC_BASIC` claims with different country fields).
Downstream verifiers receive ambiguous results.

**Guardrail**:
```solidity
// Track issued claims per (subject, schemaId, issuer) triple
mapping(address => mapping(bytes32 => mapping(address => bytes32))) private _activeClaim;
// subject => schemaId => issuer => claimId

function attest(address subject, bytes32 schemaId, bytes calldata data, uint256 expiresAt)
    external onlyRole(ISSUER_ROLE) nonReentrant returns (bytes32 claimId)
{
    bytes32 existing = _activeClaim[subject][schemaId][msg.sender];
    require(
        existing == bytes32(0) || claims[existing].revoked || _isExpired(existing),
        "ARC: active claim exists, revoke first"
    );
    claimId = keccak256(abi.encode(subject, schemaId, msg.sender, block.timestamp));
    claims[claimId] = Claim({ ... });
    _activeClaim[subject][schemaId][msg.sender] = claimId;
    emit ClaimIssued(claimId, subject, msg.sender, schemaId);
}
```

---

#### 15.2.4 Schema Collision / Poisoning

**Attack**: Attacker registers a schema with the same `name` and `version` as a
legitimate schema but with a different `fieldsJson`, causing verifiers to
misinterpret claim data. Or attacker registers a schema that exactly mirrors a
trusted schema to confuse issuer tooling.

**Guardrail**:
```solidity
// SchemaRegistry.sol
mapping(bytes32 => bool) private _registered;

function registerSchema(string calldata name, string calldata version, string calldata fieldsJson)
    external returns (bytes32 schemaId)
{
    schemaId = keccak256(abi.encodePacked(name, version, fieldsJson));
    require(!_registered[schemaId], "ARC: schema already exists");
    _registered[schemaId] = true;
    schemas[schemaId] = Schema({
        schemaId:     schemaId,
        name:         name,
        version:      version,
        fieldsJson:   fieldsJson,
        registrant:   msg.sender,
        registeredAt: block.timestamp
    });
    emit SchemaRegistered(schemaId, msg.sender, name, version);
}
```

Schemas are **immutable once registered**. No update function. If a schema needs
to change, register a new version. The `schemaId` is the canonical identifier and
it is a function of all fields — any mutation produces a different ID.

---

#### 15.2.5 Timestamp Manipulation / Expiry Bypass

**Attack**: On Arc, multiple blocks can share the same `block.timestamp`
(wall-clock second granularity, sub-second blocks). An attacker front-runs the
expiry boundary and submits a claim verification at the same timestamp as expiry.

**Guardrail**:
```solidity
function _isExpired(bytes32 claimId) internal view returns (bool) {
    uint256 exp = claims[claimId].expiresAt;
    // Use strict less-than: claim is valid only while timestamp < expiresAt
    // Equal timestamp = expired (conservative, protects against same-block boundary)
    return exp != 0 && block.timestamp >= exp;
}

function isValid(bytes32 claimId) public view returns (bool) {
    Claim memory c = claims[claimId];
    return c.claimId != bytes32(0) && !c.revoked && !_isExpired(claimId);
}
```

**Avoid** `block.timestamp` for sub-second precision decisions. Arc blocks may
share timestamps — never assume strictly increasing values.

---

#### 15.2.6 Fake Schema / Claim ID Forgery

**Attack**: Attacker crafts a `claimId` or `schemaId` off-chain that happens to
collide with (or is designed to be confused with) a real one, then presents it
to an offchain verifier that doesn't call the contract.

**Guardrail**: All verification must go through `PassportVerifier.verify()` as
an onchain call. Never trust a `claimId` passed in an API request body without
first calling `AttestationRegistry.isValid(claimId)` on the actual contract.
The backend `passportService.ts` must always validate onchain — never rely on its
own database state as the source of truth for claim validity.

```typescript
// CORRECT — always verify onchain
const valid = await publicClient.readContract({
  address: ADDRESSES.attestationRegistry,
  abi: ATTESTATION_REGISTRY_ABI,
  functionName: "isValid",
  args: [claimId],
});
if (!valid) throw new Error("Claim invalid onchain");

// INCORRECT — trusting database cache as truth
const claim = await db.findOne({ claimId });
if (claim.valid) { ... }   // database can be stale, corrupted, or spoofed
```

---

#### 15.2.7 Emergency Pause Mechanism

**Attack**: A zero-day is discovered after deployment. Without a pause, all
attestation writes continue while the team scrambles to respond.

**Guardrail**: All state-mutating functions on `AttestationRegistry` and
`SchemaRegistry` must check `whenNotPaused`. A `PAUSER_ROLE` held by a dedicated
multisig (not the same as `ISSUER_ROLE`) can halt the protocol.

```solidity
import "@openzeppelin/contracts/utils/Pausable.sol";

bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

function attest(...) external onlyRole(ISSUER_ROLE) nonReentrant whenNotPaused {
    ...
}

function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
```

`PassportVerifier.verify()` is read-only and must **not** be pausable — downstream
dApps must always be able to read existing credential state.

---

#### 15.2.8 Arc-Specific: USDC Blocklist Mid-Transaction

**Attack**: The `subject` address or `issuer` wallet is blocklisted by Circle
between when a transaction enters the mempool and when it executes. Arc enforces
USDC blocklists both pre- and post-execution — the transaction can revert
mid-flight and consume gas.

**Guardrail**: `AttestationRegistry` does not transfer USDC internally (claims
are identity records, not financial instruments). This attack is only relevant if
we add fee-based issuance in future. If we do: use a pull-payment pattern where
the issuer receives fees by calling `withdraw()`, not push payments.

---

#### 15.2.9 Arc-Specific: SELFDESTRUCT Blocked

Arc blocks `SELFDESTRUCT` during deployment when it attempts to send USDC value
to self. No contract in this project should use `SELFDESTRUCT`. If any imported
library uses it, verify the behavior before deploying.

**Foundry test**:
```solidity
// Verify none of our contracts use SELFDESTRUCT — run in CI
function test_noSelfDestruct() public pure {
    // This is a code-level check enforced by the Reviewer agent:
    // grep -r "selfdestruct" contracts/src/ must return empty
}
```

---

### 15.3 Layer 2 — Arc EVM Quirk Exploits

#### 15.3.1 USDC Decimal Confusion Attack

**Attack**: A developer mistakenly uses 18-decimal USDC amounts (native gas
representation) in ERC-20 interface calls. The result: a call intended to
transfer 1 USDC instead transfers 1,000,000,000,000 USDC (1 trillion) from
the issuer wallet, draining it instantly if sufficient balance exists.

This is not hypothetical — decimal mismatches have caused multi-million dollar
losses in DeFi. ArcPass is identity-focused and does not transfer USDC today,
but the issuer wallet holds USDC for gas. A compromised or buggy script that
calls the USDC ERC-20 interface with the wrong decimal scale can drain it.

**Guardrail — mandatory rule**:
```typescript
// ALWAYS use parseUnits with 6 for ERC-20 USDC on Arc
import { parseUnits, formatUnits } from "viem";

const USDC_DECIMALS = 6;                               // ERC-20 interface
const USDC_GAS_DECIMALS = 18;                          // native gas only — never use in ERC-20 calls

// Correct: transfer 5 USDC via ERC-20
const amount = parseUnits("5", USDC_DECIMALS);         // 5_000_000n

// WRONG — do not do this:
const amount = parseEther("5");                        // 5_000_000_000_000_000_000n — 10^12 overcharge
```

**Contract guardrail**: If any contract introduces fee collection in USDC, add
a sanity check:
```solidity
uint256 constant MAX_FEE_USDC = 100 * 1e6;   // 100 USDC ceiling (6 decimals)
require(fee <= MAX_FEE_USDC, "ARC: fee exceeds safety ceiling");
```

---

#### 15.3.2 Randomness Dependency (PREV_RANDAO = 0)

**Attack**: A developer uses `block.prevrandao` to generate a "unique" claim ID,
nonce, or token ID, not knowing it is always `0` on Arc. All generated IDs become
predictable and potentially collidable.

**Guardrail**: Claim IDs are computed from `keccak256(abi.encode(subject, schemaId, issuer, block.timestamp))`. Schema IDs from `keccak256(abi.encodePacked(name, version, fieldsJson))`. Neither uses `prevrandao`. If randomness is ever needed (future lottery, VRF-based credential challenge), use Chainlink VRF — never `block.prevrandao`, `blockhash`, or `block.difficulty`.

**CI check**: `grep -rn "prevrandao\|block.difficulty\|blockhash" contracts/src/` must return empty.

---

#### 15.3.3 Timestamp Same-Block Replay

**Attack**: On Arc, multiple transactions in the same block share the same
`block.timestamp`. If claim IDs are computed purely from timestamp + subject,
two claims issued to the same subject in the same block by the same issuer
produce identical IDs — the second overwrites the first silently.

**Guardrail**: Include a monotonic counter (or the issuer's transaction nonce)
in claim ID derivation:
```solidity
uint256 private _claimNonce;

function attest(...) external onlyRole(ISSUER_ROLE) nonReentrant whenNotPaused returns (bytes32) {
    bytes32 claimId = keccak256(
        abi.encode(subject, schemaId, msg.sender, block.timestamp, _claimNonce++)
    );
    ...
}
```

---

### 15.4 Layer 3 — Circle SDK & Key Management

#### 15.4.1 Entity Secret Compromise

**Attack**: The `CIRCLE_ENTITY_SECRET` environment variable is leaked via a
git commit, a server log, or a crash dump. Since Circle uses 2-of-2 MPC and
does not store the Entity Secret, a leaked secret gives the attacker full
unilateral control of all developer-controlled wallets — including the issuer
wallet that can call `attest()`.

<Severity: Critical — this is the Bybit-class attack for our stack>

**Guardrails**:

1. Entity Secret must **never** appear in:
   - Source code (any file)
   - Log output (mask in error handlers)
   - HTTP response bodies (never echo back env vars)
   - Docker image layers (use secret mounts, not ENV in Dockerfile)
   - CI/CD environment variables visible in build logs (use masked secrets)

2. Use a secrets manager in production (AWS Secrets Manager, HashiCorp Vault,
   or GCP Secret Manager). Never read from `.env` in production — `.env` is for
   local dev only.

3. Rotate the Entity Secret immediately if any of the following occur:
   - A git commit accidentally included it (even briefly, even in a private repo)
   - A team member with access leaves
   - Any server hosting the backend is compromised
   - The CIRCLE_API_KEY is rotated (rotate both together)

4. The Entity Secret must be re-encrypted per request — never cache or reuse
   the ciphertext across requests:
```typescript
// CORRECT — Circle SDK re-encrypts Entity Secret per request internally
// Do not cache entitySecretCiphertext between calls
const tx = await circleClient.createContractExecutionTransaction({ ... });

// WRONG — manually caching ciphertext
const cachedCipher = encryptEntitySecret(process.env.CIRCLE_ENTITY_SECRET!);
// Using cachedCipher across multiple requests violates the per-request freshness model
```

---

#### 15.4.2 API Key Scope Creep

**Attack**: The `CIRCLE_API_KEY` is over-permissioned. If compromised, an attacker
can enumerate all wallets, initiate transactions, and read balance data.

**Guardrails**:
- Create a **Standard Key** (not admin) scoped to only the operations ArcPass
  needs: `wallet:read`, `wallet:write`, `transaction:write`
- Create a **separate read-only API key** for any monitoring or dashboard services
  that only need `wallet:read`
- Rotate API keys quarterly or on any suspected exposure
- Do not share the same API key between testnet and mainnet environments

---

#### 15.4.3 Wallet ID Enumeration

**Attack**: An attacker who obtains any valid `walletId` (even from a log line or
an error message) can attempt to use it against Circle's API with a compromised
API key. Wallet IDs must be treated as sensitive.

**Guardrail**: Wallet IDs are backend secrets. They must not:
- Appear in frontend responses
- Be logged at INFO level (use DEBUG only, disabled in production)
- Be returned in API error messages

---

#### 15.4.4 Transaction Replay on testnet→mainnet Promotion

**Attack**: A developer copies a signed transaction payload from testnet and
replays it on mainnet, or a script hardcoded for `ARC-TESTNET` is accidentally
run against `ARC-MAINNET` when mainnet launches.

**Guardrail**:
```typescript
// backend/src/services/circleService.ts
const ALLOWED_BLOCKCHAIN = process.env.ARC_BLOCKCHAIN_ENV;  // "ARC-TESTNET" or "ARC-MAINNET"

function assertBlockchain(blockchain: string) {
  if (blockchain !== ALLOWED_BLOCKCHAIN) {
    throw new Error(
      `CHAIN MISMATCH: attempted ${blockchain}, env is set to ${ALLOWED_BLOCKCHAIN}`
    );
  }
}
// Call assertBlockchain() at the top of every function that submits a transaction
```

---

### 15.5 Layer 4 — Backend API Attack Vectors

#### 15.5.1 Issuer Impersonation via Header Spoofing

**Attack**: The `issuerGuard` middleware reads the caller's address from an
`x-wallet-address` header. An attacker simply sets this header to a known
ISSUER_ROLE address and bypasses the guard entirely.

**Guardrail**: Never trust the `x-wallet-address` header alone. All write
endpoints must require a **signed message** proving the caller controls the
address:

```typescript
// backend/src/middleware/auth.ts
import { verifyMessage } from "viem";

export async function requireSignedAddress(req, res, next) {
  const address   = req.headers["x-wallet-address"] as `0x${string}`;
  const signature = req.headers["x-signature"]      as `0x${string}`;
  const message   = `ArcPass auth: ${req.method} ${req.path} ${Date.now().toString().slice(0, -3)}`;
  // Timestamp is truncated to nearest second to allow a 60s window

  if (!address || !signature) {
    return res.status(401).json({ success: false, error: { code: "MISSING_AUTH" } });
  }

  const recovered = await verifyMessage({ address, message, signature });
  if (!recovered) {
    return res.status(401).json({ success: false, error: { code: "INVALID_SIGNATURE" } });
  }

  req.verifiedAddress = address;
  next();
}
```

The frontend signs the message with `useSignMessage` from wagmi before every
mutating request. The signed message includes the route path and a time window
to prevent signature replay.

---

#### 15.5.2 Replay Attack on Signed Messages

**Attack**: An attacker captures a valid signed message from a legitimate issuer
and replays it within the same time window (or beyond it if there is no window).

**Guardrail**: Use a nonce stored server-side per address:
```typescript
// In-memory nonce store (use Redis in production for distributed deployments)
const usedNonces = new Map<string, Set<string>>();

export async function requireSignedNonce(req, res, next) {
  const nonce     = req.headers["x-nonce"] as string;
  const address   = req.headers["x-wallet-address"] as `0x${string}`;
  const signature = req.headers["x-signature"] as `0x${string}`;
  const message   = `ArcPass:${req.path}:${nonce}`;

  // Nonce must be fresh (UUID or timestamp-based) and never reused
  const addressNonces = usedNonces.get(address) ?? new Set();
  if (addressNonces.has(nonce)) {
    return res.status(401).json({ success: false, error: { code: "NONCE_REUSED" } });
  }

  const valid = await verifyMessage({ address, message, signature });
  if (!valid) return res.status(401).json({ success: false, error: { code: "BAD_SIG" } });

  addressNonces.add(nonce);
  usedNonces.set(address, addressNonces);   // persist to Redis in production
  req.verifiedAddress = address;
  next();
}
```

---

#### 15.5.3 Rate Limiting & DoS on Attestation Endpoints

**Attack**: An adversary floods `POST /attest` with thousands of requests from
multiple addresses, exhausting the issuer wallet's USDC gas balance and making
the service unresponsive.

**Guardrails**:
```typescript
// backend/src/index.ts
import rateLimit from "express-rate-limit";

// Global rate limit — all routes
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// Strict limit on write endpoints
const attestLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,                // max 5 attestation submissions per address per minute
  keyGenerator: (req) => req.headers["x-wallet-address"] as string || req.ip,
  message: { success: false, error: { code: "RATE_LIMITED" } },
});

app.post("/attest", requireSignedNonce, issuerGuard, attestLimiter, attestRoute);
```

Additionally, configure a **USDC gas balance alert**: if the issuer wallet drops
below 10 USDC, send an alert to the ops channel. Never let it hit zero silently.

---

#### 15.5.4 IPFS Metadata Injection

**Attack**: A malicious issuer submits crafted metadata JSON to the IPFS upload
endpoint that contains XSS payloads, excessively large fields, or fields that
impersonate another issuer's metadata structure.

**Guardrails**:
```typescript
// backend/src/utils/metadataBuilder.ts — validate before pinning
import { z } from "zod";

const IdentityMetadataSchema = z.object({
  arcpass_version: z.literal("1.0"),
  type:            z.literal("identity"),
  name:            z.string().max(100).regex(/^[\w\s\-\.]+$/),  // no HTML
  description:     z.string().max(500).optional(),
  image:           z.string().startsWith("ipfs://").optional(),
  created_at:      z.string().datetime(),
  attributes:      z.array(z.object({
    trait_type:    z.string().max(50),
    value:         z.union([z.string().max(200), z.number()]),
  })).max(20),
});

export function validateAndBuildMetadata(raw: unknown) {
  return IdentityMetadataSchema.parse(raw);   // throws ZodError if invalid
}
```

IPFS uploads must always go through `metadataBuilder.ts` — never pass raw
user-controlled JSON directly to Pinata.

---

#### 15.5.5 SSRF via Metadata URI Fetch

**Attack**: A backend route fetches IPFS metadata from a URI supplied by the
user. An attacker passes `http://169.254.169.254/latest/meta-data/` (AWS metadata
endpoint) or `http://localhost:3001/admin/...` as the metadata URI, causing the
server to make requests to internal services.

**Guardrail**:
```typescript
// backend/src/services/ipfsService.ts
const ALLOWED_IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

export function resolveIpfsUri(uri: string): string {
  if (!uri.startsWith("ipfs://")) {
    throw new Error("Only ipfs:// URIs are accepted");
  }
  const cid = uri.replace("ipfs://", "");
  // Validate CID format (base58 or CIDv1)
  if (!/^[a-zA-Z0-9]{46,59}$/.test(cid) && !/^bafkrei[a-z0-9]{50,}$/.test(cid)) {
    throw new Error("Invalid IPFS CID format");
  }
  return `${ALLOWED_IPFS_GATEWAYS[0]}${cid}`;
}
```

Never fetch arbitrary HTTP URLs from backend services. Only accept `ipfs://`
URIs with validated CID format.

---

#### 15.5.6 Database / Cache Poisoning

**Attack**: If the backend caches attestation state in a database (MongoDB,
Redis, PostgreSQL) and a bug or injection causes the cache to diverge from
onchain state, dApps that rely on the cache will grant or deny access
incorrectly.

**Guardrail**: The cache is **advisory only**. Treat it as a performance layer,
not a truth layer. Implement a cache invalidation strategy:

```typescript
// backend/src/services/passportService.ts
async function getPassport(address: string): Promise<PassportDocument> {
  const cached = await cache.get(`passport:${address}`);
  if (cached) {
    // Re-verify the most recent claimId onchain before serving
    const spot = cached.claims[0];
    const stillValid = await publicClient.readContract({
      address: ADDRESSES.attestationRegistry,
      abi:     ATTESTATION_REGISTRY_ABI,
      functionName: "isValid",
      args:    [spot.claimId],
    });
    if (!stillValid) {
      await cache.del(`passport:${address}`);
      return buildPassportFromChain(address);
    }
    return cached;
  }
  return buildPassportFromChain(address);
}
```

All critical access decisions by third-party verifiers must call the contract
directly, not our API's cache.

---

### 15.6 Layer 5 — Frontend & Wallet Attack Vectors

#### 15.6.1 Transaction Simulation Bypass (Blind Signing)

**Attack**: A malicious frontend (or a compromised dependency via supply-chain
attack) presents a transaction for signing that differs from what the user
believes they are signing. The user approves a `grantRole(ISSUER_ROLE, attacker)`
call thinking they are registering an identity.

**Guardrails**:

1. Always simulate transactions before requesting user signature:
```typescript
// frontend/src/hooks/useArcContract.ts
import { useSimulateContract, useWriteContract } from "wagmi";

// Simulate first — shows user exactly what the tx does and catches reverts
const { data: simResult } = useSimulateContract({
  address: ADDRESSES.attestationRegistry,
  abi:     ATTESTATION_REGISTRY_ABI,
  functionName: "attest",
  args:    [subject, schemaId, encodedData, expiresAt],
});

// Only proceed to write if simulation succeeded
const { writeContract } = useWriteContract();
const handleSubmit = () => {
  if (!simResult?.request) return;
  writeContract(simResult.request);
};
```

2. Display the decoded transaction in the UI before the wallet prompt:
   - Function name: `attest`
   - Subject: `0x...` (truncated + full on hover)
   - Schema: schema name (resolved from `SchemaRegistry`)
   - Expiry: human-readable date or "No expiry"

3. Lock `npm` / `yarn` dependencies with `--frozen-lockfile` in CI. Run
   `npm audit` and fail builds on high/critical advisories.

---

#### 15.6.2 Wallet Drainer via Malicious Approval

**Attack**: A phishing variant specific to the Issuer dashboard: a malicious
actor tricks an issuer into approving a USDC spend allowance on the issuer's
connected wallet to a drainer contract, disguised as a "schema registration fee".

**Guardrail**: ArcPass does not require any USDC ERC-20 `approve()` calls from
user wallets. If the frontend ever prompts for a USDC approval, it is either a
bug or an active attack. This rule must be documented in the UI:

```tsx
// frontend/src/pages/Issuer.tsx
<Alert variant="warning">
  ArcPass never asks you to approve token spending. If you see a token approval
  request from this site, reject it immediately and report it.
</Alert>
```

---

#### 15.6.3 DNS Hijacking / Frontend Replacement

**Attack**: An attacker compromises the DNS record or CDN serving the frontend
and replaces it with a look-alike that harvests signatures or private keys.

**Guardrails**:
1. Enforce Subresource Integrity (SRI) on all CDN-loaded scripts in `index.html`
2. Configure Content Security Policy headers on the static host:
```
Content-Security-Policy:
  default-src 'self';
  script-src  'self' 'sha256-<hash>';
  connect-src 'self' https://rpc.testnet.arc.network https://api.pinata.cloud;
  img-src     'self' data: https://gateway.pinata.cloud;
  style-src   'self' 'unsafe-inline';
```
3. Enable HSTS on the domain with `includeSubDomains` and `preload`
4. Use a hardware wallet (Ledger/Trezor) for the deployer / admin multisig keys —
   browser-based wallets are susceptible to malicious page injection

---

#### 15.6.4 Dependency Supply Chain Attack

**Attack**: A compromised npm package (event-stream-style attack) injects
credential-stealing code into the frontend or backend build.

**Guardrails**:
- Pin exact versions in `package.json` (no `^` or `~` in production dependencies)
- Commit `package-lock.json` or `yarn.lock` and verify it in CI
- Run `npm audit --audit-level=high` in CI; fail on any high or critical finding
- Use Dependabot or Renovate bot for automated patch PRs — review each one
- Minimize the dependency tree: prefer viem over ethers + web3 + other libraries

---

### 15.7 Layer 6 — Human & Operational Attacks

#### 15.7.1 Private Key / Secret Leak via Git

**Attack**: A developer accidentally commits `.env`, a private key, or the
Entity Secret to git. Even if removed in the next commit, it is permanently
in git history and will be found by automated scanners within hours.

**Guardrails**:
```bash
# .gitignore — enforce these entries
.env
.env.*
!.env.example
contracts/.env
*.pem
*.key
foundry.toml.local
```

Configure `git-secrets` or `trufflesecurity/trufflehog` as a pre-commit hook:
```bash
# Install once per developer machine
brew install git-secrets
git secrets --install
git secrets --register-aws

# Add custom patterns for Circle secrets
git secrets --add 'CIRCLE_ENTITY_SECRET\s*=\s*.+'
git secrets --add 'CIRCLE_API_KEY\s*=\s*.+'
```

If a leak occurs: **rotate immediately, do not wait to verify**. Assume the
secret has been harvested the moment it appeared in a commit.

---

#### 15.7.2 Social Engineering / Impersonation

**Attack**: A threat actor contacts a developer impersonating Circle support,
requesting the Entity Secret or API key for "account verification" or "incident
response". This is the #1 attack vector for credential theft in 2025–2026 per
Immunefi research.

**Rule**: Circle will never ask for your Entity Secret. It is not stored by
Circle and they have no reason to request it. If any party requests the
Entity Secret via email, Slack, Discord, Telegram, or any other channel,
treat it as an active social engineering attack. Report it to the team lead
immediately. Do not respond to the attacker.

---

#### 15.7.3 Insider Threat / Compromised Team Account

**Attack**: A team member's development machine or GitHub account is compromised.
The attacker gains access to repository secrets, deployment pipelines, or the
backend server's environment variables.

**Guardrails**:
1. **Principle of least privilege** in GitHub: repository write access only for
   active contributors. No team member has unilateral deploy access to production.
2. **Required PR reviews**: all merges to `main` require at least 2 approvals.
   Branch protection rules enforced at the repository level.
3. **Separate CI secrets from developer access**: the CI/CD pipeline accesses
   production secrets via its own service account — developers should not have
   direct access to production environment variable values.
4. **Audit log**: enable GitHub audit log for the organization. Review it monthly.
5. **2FA mandatory** on all GitHub accounts with write access.

---

#### 15.7.4 Deployment Script Misfire

**Attack**: A developer runs `forge script Deploy.s.sol --rpc-url $ARC_RPC_URL`
with `ARC_RPC_URL` pointing to mainnet instead of testnet, deploying unaudited
contracts to a live environment.

**Guardrail**: Deployment scripts must require an explicit `--broadcast` flag
AND a `DEPLOYMENT_ENV=mainnet` confirmation env var before touching mainnet:

```solidity
// contracts/script/Deploy.s.sol
function run() external {
    string memory env = vm.envString("DEPLOYMENT_ENV");
    require(
        keccak256(bytes(env)) == keccak256(bytes("testnet")) ||
        keccak256(bytes(env)) == keccak256(bytes("mainnet-confirmed")),
        "Set DEPLOYMENT_ENV=testnet or DEPLOYMENT_ENV=mainnet-confirmed"
    );
    if (keccak256(bytes(env)) == keccak256(bytes("mainnet-confirmed"))) {
        console.log("!!! MAINNET DEPLOYMENT — 10 second window to abort with Ctrl+C");
        vm.sleep(10_000);
    }
    vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
    // ... deploy contracts
    vm.stopBroadcast();
}
```

---

### 15.8 Monitoring & Incident Response

#### 15.8.1 Onchain Event Monitoring

Deploy an event listener in production that alerts on anomalous activity:

```typescript
// backend/src/monitoring/eventMonitor.ts
const ALERT_THRESHOLDS = {
  attestationsPerMinute:  50,    // normal throughput ceiling
  revocationsPerMinute:   20,    // bulk revocation is suspicious
  roleGrantsPerHour:       2,    // unexpected admin activity
  schemaRegistrations:     5,    // per hour
};

// Watch for these events and alert if thresholds are exceeded:
// ClaimIssued(bytes32 claimId, address subject, address issuer, bytes32 schemaId)
// ClaimRevoked(bytes32 claimId, address revoker, uint256 timestamp)
// RoleGranted(bytes32 role, address account, address sender)     ← CRITICAL alert
// Paused(address account)                                         ← CRITICAL alert
// Unpaused(address account)                                       ← CRITICAL alert
```

Any `RoleGranted` event for `DEFAULT_ADMIN_ROLE` or `ISSUER_ROLE` must trigger
an immediate alert to the security channel — no threshold, always alert.

---

#### 15.8.2 Gas Balance Monitoring

The issuer wallet's USDC balance funds all onchain transactions. A drained wallet
silently stops the service.

```typescript
// Monitor issuer wallet balance every 5 minutes
const balance = await publicClient.getBalance({ address: ISSUER_WALLET_ADDRESS });
const usdcBalance = formatUnits(balance, 18);  // native representation
if (parseFloat(usdcBalance) < 10) {
  sendAlert(`⚠️ Issuer wallet below 10 USDC: ${usdcBalance} USDC remaining`);
}
```

---

#### 15.8.3 Incident Response Runbook

```
INCIDENT LEVEL 1 — Suspicious activity detected (anomalous event rate)
  1. Review event monitor logs
  2. Identify the suspicious address
  3. Decide: pause or continue monitoring
  ETA to decision: < 15 minutes

INCIDENT LEVEL 2 — Active exploit in progress (unexpected role grant, mass revocation)
  1. PAUSER_ROLE multisig calls pause() immediately — no debate
  2. Post-pause: read all state changes since last known-good block
  3. Identify root cause before unpausing
  ETA to pause: < 5 minutes

INCIDENT LEVEL 3 — Key / secret compromise (Entity Secret or API key leaked)
  1. Rotate CIRCLE_ENTITY_SECRET immediately via Circle Console
  2. Rotate CIRCLE_API_KEY
  3. Revoke and reissue all active issuer CIRCLE_ISSUER_WALLET_IDs
  4. Audit all transactions submitted in the last 24 hours
  5. Notify affected identity holders
  ETA to rotation: < 10 minutes

INCIDENT LEVEL 4 — Contract exploit (claims issued to unauthorized subjects)
  1. Pause all contracts immediately
  2. Snapshot onchain state
  3. Identify all fraudulent claimIds
  4. Prepare revocation list
  5. Deploy patched contract (new address — contracts are immutable)
  6. Migrate legitimate claims
  7. Disclose publicly
```

---

### 15.9 Security Checklist (Reviewer Agent — Pre-Merge)

This checklist is the Reviewer's responsibility. **Every item must pass or have
a written waiver from two team members before merge to `main`.**

#### Smart contracts
- [ ] `ISSUER_ROLE` required on `attest()`, enforced via `onlyRole`
- [ ] `REVOKER_ROLE` required on `revoke()`, separate from `ISSUER_ROLE`
- [ ] `PAUSER_ROLE` required on `pause()` / `unpause()`
- [ ] `DEFAULT_ADMIN_ROLE` renounced from EOA deployer post-deployment
- [ ] `nonReentrant` on all state-mutating functions
- [ ] `whenNotPaused` on all state-mutating functions
- [ ] No `SELFDESTRUCT` in any contract or imported library
- [ ] No `block.prevrandao` usage anywhere
- [ ] Claim ID includes nonce to prevent same-block collision
- [ ] Schema immutability enforced (no update function)
- [ ] Duplicate attestation guard (active claim must be revoked before reissuance)
- [ ] Expiry uses `>=` (expired at boundary, not after)
- [ ] No external calls to user-controlled addresses (`subject`)
- [ ] USDC ceiling on any future fee functions
- [ ] `forge test` passes with 100% of role/access tests

#### Backend
- [ ] Entity Secret never logged at any level
- [ ] Wallet IDs never returned in API responses
- [ ] All write routes require signature verification, not just header check
- [ ] Nonce anti-replay enforced on signed messages
- [ ] Rate limiting on all attestation write endpoints
- [ ] IPFS URI validated as `ipfs://` with CID format check before fetch
- [ ] Metadata validated through Zod schema before Pinata upload
- [ ] All onchain verification goes through `isValid()` call, not DB cache
- [ ] Blockchain env guard (`assertBlockchain`) on every transaction submission
- [ ] USDC amounts use `parseUnits(amount, 6)`, never `parseEther`

#### Frontend
- [ ] Transactions simulated before user signature request
- [ ] No USDC `approve()` flow exists on any page
- [ ] CSP headers configured on hosting platform
- [ ] Dependencies pinned with exact versions
- [ ] `npm audit --audit-level=high` passes in CI
- [ ] No private keys, secrets, or wallet IDs in any frontend source file
- [ ] ArcPass disclaimer displayed on Issuer page (no approval requests)

#### Operations
- [ ] `.env` in `.gitignore`, confirmed not tracked
- [ ] `git-secrets` or equivalent pre-commit hook active
- [ ] All team GitHub accounts have 2FA enabled
- [ ] Branch protection: 2 required PR reviews on `main`
- [ ] CI does not expose secret values in build logs
- [ ] Event monitor deployed and alert thresholds configured
- [ ] Gas balance monitor deployed and alert threshold set
- [ ] Incident runbook accessible to all team members (not gated behind secrets)

---

*Security section end — ArcPass v1.0*
*Based on 2024–2025 onchain incident data. Threat model must be reviewed and*
*updated before any mainnet deployment.*

---

## 16. Attestation Service Expansion — Multi-Domain Protocol

> ArcPass is no longer only a passport. The `AttestationRegistry` is the
> foundation of a **general-purpose attestation platform**. This section
> expands the protocol into nine distinct attestation service verticals,
> each with its own schema set, issuer logic, frontend surface, and API
> routes — all sharing the same underlying contract infrastructure.
>
> The passport (identity + KYC) becomes **one service among many**.
> Every service speaks the same language: `schemaId → attest → verify`.

---

### 16.1 Mental Model — Service Architecture

```
AttestationRegistry (Arc L1)
         │
         ├── SERVICE: Identity & Passport      (was the whole product)
         ├── SERVICE: KYC / Compliance
         ├── SERVICE: Professional Credentials
         ├── SERVICE: DAO & Governance
         ├── SERVICE: Reputation & Trust Score
         ├── SERVICE: Employment & HR
         ├── SERVICE: Education
         ├── SERVICE: Social Verification
         └── SERVICE: Custom / Open Registry
```

Every service shares:
- The same `AttestationRegistry.sol` contract
- The same `SchemaRegistry.sol` contract
- The same `PassportVerifier.sol` for cross-service verification
- The same Circle wallet issuer infrastructure
- The same IPFS metadata pipeline

Every service gets its own:
- Pre-registered schema set (defined below in §16.3)
- Issuer-specific business logic in `backend/src/services/attestation/`
- API route namespace under `/api/v1/<service>/`
- Frontend section inside ArcPass Studio (§16.5)
- Schema template in the visual builder UI

---

### 16.2 Revised Repository Layout (Attestation Services Layer)

The monorepo expands as follows. New paths are marked `[NEW]`.

```
arcpass/
│
├── contracts/src/
│   ├── core/
│   │   ├── AttestationRegistry.sol       (unchanged — serves all services)
│   │   ├── SchemaRegistry.sol            (unchanged)
│   │   └── PassportVerifier.sol          (unchanged — multi-schema verify)
│   └── services/                         [NEW]
│       ├── schemas/
│       │   ├── IdentitySchemas.sol        [NEW] — on-chain schema ID constants
│       │   ├── KycSchemas.sol             [NEW]
│       │   ├── CredentialSchemas.sol      [NEW]
│       │   ├── DaoSchemas.sol             [NEW]
│       │   ├── ReputationSchemas.sol      [NEW]
│       │   ├── EmploymentSchemas.sol      [NEW]
│       │   ├── EducationSchemas.sol       [NEW]
│       │   ├── SocialSchemas.sol          [NEW]
│       │   └── SchemaIds.sol              [NEW] — single import for all schema IDs
│       └── verifiers/
│           ├── KycGate.sol                [NEW] — gating contract for KYC-required dApps
│           ├── DaoMembershipGate.sol      [NEW] — gating contract for DAO access
│           └── ReputationGate.sol         [NEW] — minimum score gate
│
├── backend/src/
│   ├── services/
│   │   ├── attestation/                   [NEW — replaces single attestationService.ts]
│   │   │   ├── index.ts                   [NEW] — service registry + router
│   │   │   ├── base/
│   │   │   │   └── BaseAttestationService.ts  [NEW] — shared issuer logic
│   │   │   ├── identity/
│   │   │   │   └── IdentityAttestationService.ts  [NEW]
│   │   │   ├── kyc/
│   │   │   │   └── KycAttestationService.ts       [NEW]
│   │   │   ├── credentials/
│   │   │   │   └── CredentialAttestationService.ts [NEW]
│   │   │   ├── dao/
│   │   │   │   └── DaoAttestationService.ts       [NEW]
│   │   │   ├── reputation/
│   │   │   │   └── ReputationAttestationService.ts [NEW]
│   │   │   ├── employment/
│   │   │   │   └── EmploymentAttestationService.ts [NEW]
│   │   │   ├── education/
│   │   │   │   └── EducationAttestationService.ts [NEW]
│   │   │   ├── social/
│   │   │   │   └── SocialAttestationService.ts    [NEW]
│   │   │   └── custom/
│   │   │       └── CustomAttestationService.ts    [NEW]
│   │   └── schemaService.ts               (extended — manages all service schemas)
│   └── routes/
│       ├── v1/                            [NEW — versioned routes]
│       │   ├── identity.ts
│       │   ├── kyc.ts                     [NEW]
│       │   ├── credentials.ts             [NEW]
│       │   ├── dao.ts                     [NEW]
│       │   ├── reputation.ts              [NEW]
│       │   ├── employment.ts              [NEW]
│       │   ├── education.ts               [NEW]
│       │   ├── social.ts                  [NEW]
│       │   ├── custom.ts                  [NEW]
│       │   └── passport.ts                (extended — aggregates all services)
│       └── schemas.ts                     (extended)
│
├── frontend/src/
│   ├── pages/
│   │   ├── studio/                        [NEW — ArcPass Studio for issuers]
│   │   │   ├── Studio.tsx                 [NEW] — studio shell
│   │   │   ├── SchemaBuilder.tsx          [NEW] — visual field builder
│   │   │   ├── SchemaTemplates.tsx        [NEW] — pre-built schema templates
│   │   │   ├── IssueDashboard.tsx         [NEW] — issue attestations by service
│   │   │   ├── RevokeDashboard.tsx        [NEW] — revoke management
│   │   │   └── AnalyticsDashboard.tsx     [NEW] — issuance stats per service
│   │   ├── Passport.tsx                   (extended — shows all service badges)
│   │   └── services/                      [NEW — per-service public pages]
│   │       ├── KycVerify.tsx              [NEW]
│   │       ├── CredentialView.tsx         [NEW]
│   │       └── ReputationView.tsx         [NEW]
│   └── components/
│       ├── studio/                        [NEW]
│       │   ├── FieldBuilder.tsx           [NEW]
│       │   ├── TemplateSelector.tsx       [NEW]
│       │   └── ServiceSelector.tsx        [NEW]
│       └── passport/
│           ├── ServiceBadge.tsx           [NEW] — per-service credential card
│           └── PassportCard.tsx           (extended — renders all service badges)
```

---

### 16.3 Schema Definitions — All Nine Services

Every schema below must be registered onchain via `SchemaRegistry` during the
`SeedTestData.s.sol` Foundry script on deployment. Schema IDs (computed from
`keccak256(abi.encodePacked(name, version, fieldsJson))`) are stored as Solidity
constants in the corresponding `*Schemas.sol` file under `contracts/src/services/schemas/`.

The `fieldsJson` string must exactly match what is registered — whitespace
differences produce a different `schemaId`. Store the canonical `fieldsJson`
as a TypeScript constant in `backend/src/constants/schemas.ts` and import it
into both the seed script and the backend services.

---

#### SERVICE 1 — Identity & Passport

These are the original ArcPass schemas. Listed here for completeness and to
establish the naming convention all other services follow.

```typescript
// backend/src/constants/schemas.ts — SERVICE 1

export const IDENTITY_SCHEMAS = {
  BASIC_IDENTITY: {
    name: "arcpass_identity",
    version: "1.0.0",
    fields: [
      { name: "displayName", type: "string"  },
      { name: "avatarCid",   type: "string"  },
      { name: "createdAt",   type: "uint64"  },
    ],
  },

  LIVENESS_VERIFIED: {
    name: "arcpass_liveness",
    version: "1.0.0",
    fields: [
      { name: "verified",  type: "bool"    },
      { name: "provider",  type: "string"  },  // "mediapipe_v2", "worldcoin", etc.
      { name: "checkedAt", type: "uint64"  },
    ],
  },
} as const;
```

---

#### SERVICE 2 — KYC / Compliance

Issuers: licensed KYC providers, compliance firms, government ID services.
Use cases: DeFi access gating, regulated dApp onboarding, fiat ramp eligibility.

```typescript
export const KYC_SCHEMAS = {

  // Tier 1: basic ID check (name + country confirmed)
  KYC_BASIC: {
    name: "arcpass_kyc_basic",
    version: "1.0.0",
    fields: [
      { name: "level",     type: "uint8"   },  // 1=basic, 2=standard, 3=enhanced
      { name: "country",   type: "string"  },  // ISO 3166-1 alpha-2
      { name: "provider",  type: "string"  },  // issuing KYC provider name
      { name: "checkedAt", type: "uint64"  },
    ],
  },

  // Tier 2: AML / sanctions screening result
  AML_SCREENING: {
    name: "arcpass_aml_screening",
    version: "1.0.0",
    fields: [
      { name: "passed",    type: "bool"    },  // true = passed screening
      { name: "provider",  type: "string"  },  // "elliptic", "trm_labs", "chainalysis"
      { name: "checkedAt", type: "uint64"  },
    ],
  },

  // Tier 3: accredited investor status (for tokenized securities)
  ACCREDITED_INVESTOR: {
    name: "arcpass_accredited_investor",
    version: "1.0.0",
    fields: [
      { name: "jurisdiction", type: "string"  },  // country of accreditation
      { name: "validUntil",   type: "uint64"  },  // unix timestamp
      { name: "provider",     type: "string"  },
    ],
  },

  // Age gate — privacy-preserving (no DOB stored, only boolean)
  AGE_OVER_18: {
    name: "arcpass_age_over18",
    version: "1.0.0",
    fields: [
      { name: "over18",    type: "bool"    },
      { name: "checkedAt", type: "uint64"  },
      { name: "provider",  type: "string"  },
    ],
  },
} as const;
```

**KycGate.sol** — gating contract for external dApps:

```solidity
// contracts/src/services/verifiers/KycGate.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/PassportVerifier.sol";
import "../services/schemas/KycSchemas.sol";

/// @notice Stateless gate. dApps inherit or call this to restrict access to KYC-verified addresses.
contract KycGate {
    PassportVerifier public immutable verifier;

    constructor(address _verifier) {
        verifier = PassportVerifier(_verifier);
    }

    modifier onlyKycVerified(address subject, uint8 minLevel) {
        VerificationResult memory result = verifier.verify(subject, KycSchemas.KYC_BASIC_ID);
        require(result.valid, "KycGate: subject not KYC verified");
        (, uint8 level, ,) = abi.decode(result.data, (uint8, string, string, uint64));
        require(level >= minLevel, "KycGate: KYC level insufficient");
        _;
    }

    function isKycVerified(address subject, uint8 minLevel) external view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, KycSchemas.KYC_BASIC_ID);
        if (!result.valid) return false;
        (, uint8 level, ,) = abi.decode(result.data, (uint8, string, string, uint64));
        return level >= minLevel;
    }
}
```

**API routes** — `POST /api/v1/kyc/issue`, `GET /api/v1/kyc/status/:address`,
`POST /api/v1/kyc/aml/issue`, `GET /api/v1/kyc/aml/:address`

---

#### SERVICE 3 — Professional Credentials

Issuers: professional bodies, certification authorities, licensing boards.
Use cases: verified LinkedIn-style profiles, permissioned professional networks,
regulated service access (legal, medical, financial advice dApps).

```typescript
export const CREDENTIAL_SCHEMAS = {

  // Generic professional certification
  CERTIFICATION: {
    name: "arcpass_certification",
    version: "1.0.0",
    fields: [
      { name: "certName",     type: "string"  },  // "Certified Solidity Developer"
      { name: "issuingBody",  type: "string"  },  // "Ethereum Foundation", "CFA Institute"
      { name: "certId",       type: "string"  },  // external certificate ID (opaque)
      { name: "issuedAt",     type: "uint64"  },
      { name: "validUntil",   type: "uint64"  },  // 0 = no expiry
    ],
  },

  // Professional license (regulated professions)
  LICENSE: {
    name: "arcpass_license",
    version: "1.0.0",
    fields: [
      { name: "licenseType",   type: "string"  },  // "attorney", "doctor", "engineer"
      { name: "licenseNumber", type: "string"  },
      { name: "jurisdiction",  type: "string"  },
      { name: "issuingBody",   type: "string"  },
      { name: "validUntil",    type: "uint64"  },
    ],
  },

  // Skill endorsement (peer-issued, lighter weight)
  SKILL_ENDORSEMENT: {
    name: "arcpass_skill",
    version: "1.0.0",
    fields: [
      { name: "skill",       type: "string"  },  // "Solidity", "React", "Swahili"
      { name: "level",       type: "uint8"   },  // 1=beginner, 2=intermediate, 3=expert
      { name: "endorsedBy",  type: "address" },  // issuer address (redundant but explicit)
    ],
  },
} as const;
```

**API routes** — `POST /api/v1/credentials/certify`, `POST /api/v1/credentials/license`,
`POST /api/v1/credentials/endorse`, `GET /api/v1/credentials/:address`

---

#### SERVICE 4 — DAO & Governance

Issuers: DAOs, multisigs, governance contracts, protocol treasuries.
Use cases: token-gated communities, off-chain snapshot voting weight, governance role assignment.

```typescript
export const DAO_SCHEMAS = {

  // DAO membership record
  DAO_MEMBERSHIP: {
    name: "arcpass_dao_membership",
    version: "1.0.0",
    fields: [
      { name: "daoName",     type: "string"  },
      { name: "daoAddress",  type: "address" },
      { name: "role",        type: "string"  },  // "member", "delegate", "core", "multisig"
      { name: "joinedAt",    type: "uint64"  },
      { name: "votingWeight", type: "uint256" }, // voting power snapshot
    ],
  },

  // Governance contribution record
  GOVERNANCE_PARTICIPATION: {
    name: "arcpass_governance_participation",
    version: "1.0.0",
    fields: [
      { name: "daoAddress",       type: "address" },
      { name: "proposalsPassed",  type: "uint32"  },
      { name: "votesParticipated", type: "uint32" },
      { name: "delegatesCount",   type: "uint32"  },
      { name: "updatedAt",        type: "uint64"  },
    ],
  },

  // Delegate registry entry
  DELEGATE: {
    name: "arcpass_delegate",
    version: "1.0.0",
    fields: [
      { name: "daoAddress",    type: "address" },
      { name: "delegatedFrom", type: "address[]" }, // list of delegators
      { name: "statement",     type: "string"   }, // IPFS CID to delegate platform
    ],
  },
} as const;
```

**DaoMembershipGate.sol**:

```solidity
// contracts/src/services/verifiers/DaoMembershipGate.sol
contract DaoMembershipGate {
    PassportVerifier public immutable verifier;

    constructor(address _verifier) {
        verifier = PassportVerifier(_verifier);
    }

    /// @notice Returns true if subject is a member of the given DAO address with at least minRole.
    function isMember(address subject, address dao) external view returns (bool) {
        VerificationResult memory result = verifier.verify(subject, DaoSchemas.DAO_MEMBERSHIP_ID);
        if (!result.valid) return false;
        (, address claimedDao, , ,) =
            abi.decode(result.data, (string, address, string, uint64, uint256));
        return claimedDao == dao;
    }
}
```

**API routes** — `POST /api/v1/dao/enroll`, `POST /api/v1/dao/participation/update`,
`GET /api/v1/dao/member/:address`, `DELETE /api/v1/dao/revoke`

---

#### SERVICE 5 — Reputation & Trust Score

Issuers: protocols, marketplaces, relayers, any party that observes behavior.
Use cases: undercollateralized lending risk scoring, P2P marketplace trust,
cross-protocol reputation portability.

```typescript
export const REPUTATION_SCHEMAS = {

  // Aggregate reputation score
  REPUTATION_SCORE: {
    name: "arcpass_reputation_score",
    version: "1.0.0",
    fields: [
      { name: "score",         type: "uint256" },  // 0–10000 (basis points)
      { name: "domain",        type: "string"  },  // "defi", "marketplace", "social"
      { name: "dataPoints",    type: "uint32"  },  // how many observations
      { name: "updatedAt",     type: "uint64"  },
    ],
  },

  // Positive interaction record (peer endorsement)
  POSITIVE_INTERACTION: {
    name: "arcpass_positive_interaction",
    version: "1.0.0",
    fields: [
      { name: "context",       type: "string"  },  // "completed_trade", "repaid_loan"
      { name: "counterparty",  type: "address" },
      { name: "platform",      type: "string"  },
      { name: "occurredAt",    type: "uint64"  },
    ],
  },

  // Negative / dispute record (issuer-gated, high threshold)
  DISPUTE_RECORD: {
    name: "arcpass_dispute_record",
    version: "1.0.0",
    fields: [
      { name: "type",          type: "string"  },  // "scam", "default", "fraud"
      { name: "reportedBy",    type: "address" },
      { name: "evidence",      type: "string"  },  // IPFS CID to evidence
      { name: "resolvedAt",    type: "uint64"  },  // 0 = unresolved
    ],
  },
} as const;
```

**ReputationGate.sol**:

```solidity
// contracts/src/services/verifiers/ReputationGate.sol
contract ReputationGate {
    PassportVerifier public immutable verifier;
    uint256 public immutable minScore;  // set at deploy time

    constructor(address _verifier, uint256 _minScore) {
        verifier  = PassportVerifier(_verifier);
        minScore  = _minScore;
    }

    modifier onlyReputable(address subject) {
        VerificationResult memory result =
            verifier.verify(subject, ReputationSchemas.REPUTATION_SCORE_ID);
        require(result.valid, "ReputationGate: no reputation score");
        (uint256 score,,,) = abi.decode(result.data, (uint256, string, uint32, uint64));
        require(score >= minScore, "ReputationGate: score below threshold");
        _;
    }
}
```

**API routes** — `POST /api/v1/reputation/record`, `POST /api/v1/reputation/dispute`,
`GET /api/v1/reputation/score/:address`, `GET /api/v1/reputation/history/:address`

---

#### SERVICE 6 — Employment & HR

Issuers: employers, staffing agencies, HR platforms, payroll providers.
Use cases: verifiable work history for DeFi collateral, gig economy trust,
background checks without exposing raw data to relying parties.

```typescript
export const EMPLOYMENT_SCHEMAS = {

  EMPLOYMENT_RECORD: {
    name: "arcpass_employment",
    version: "1.0.0",
    fields: [
      { name: "employer",     type: "string"  },  // company name
      { name: "role",         type: "string"  },
      { name: "startDate",    type: "uint64"  },
      { name: "endDate",      type: "uint64"  },  // 0 = current
      { name: "employerDid",  type: "string"  },  // optional DID or onchain address
    ],
  },

  INCOME_BAND: {
    name: "arcpass_income_band",
    version: "1.0.0",
    fields: [
      { name: "currency",     type: "string"  },  // "USD", "ETB"
      { name: "bandMin",      type: "uint256" },  // annual income range floor
      { name: "bandMax",      type: "uint256" },  // annual income range ceiling
      { name: "verifiedAt",   type: "uint64"  },
      { name: "provider",     type: "string"  },
    ],
  },

  CONTRACTOR_RECORD: {
    name: "arcpass_contractor",
    version: "1.0.0",
    fields: [
      { name: "platform",     type: "string"  },  // "Upwork", "Fiverr", "direct"
      { name: "completedJobs", type: "uint32" },
      { name: "totalEarned",  type: "uint256" },  // in USDC cents (6 decimal)
      { name: "rating",       type: "uint16"  },  // 0–10000 basis points
      { name: "updatedAt",    type: "uint64"  },
    ],
  },
} as const;
```

**API routes** — `POST /api/v1/employment/issue`, `POST /api/v1/employment/income`,
`GET /api/v1/employment/:address`, `DELETE /api/v1/employment/revoke/:claimId`

---

#### SERVICE 7 — Education

Issuers: universities, MOOCs, bootcamps, professional institutes.
Use cases: credential verification for employment dApps, scholarship DAOs,
knowledge-gated communities.

```typescript
export const EDUCATION_SCHEMAS = {

  DEGREE: {
    name: "arcpass_degree",
    version: "1.0.0",
    fields: [
      { name: "institution",      type: "string"  },
      { name: "degree",           type: "string"  },  // "BSc", "MSc", "PhD"
      { name: "fieldOfStudy",     type: "string"  },  // "Computer Science"
      { name: "graduationYear",   type: "uint16"  },
      { name: "institutionDid",   type: "string"  },  // optional
    ],
  },

  COURSE_COMPLETION: {
    name: "arcpass_course",
    version: "1.0.0",
    fields: [
      { name: "courseName",    type: "string"  },
      { name: "provider",      type: "string"  },  // "Coursera", "Alchemy University"
      { name: "score",         type: "uint8"   },  // 0–100
      { name: "completedAt",   type: "uint64"  },
      { name: "certificateId", type: "string"  },  // external cert ID
    ],
  },

  BOOTCAMP_GRADUATE: {
    name: "arcpass_bootcamp",
    version: "1.0.0",
    fields: [
      { name: "bootcamp",      type: "string"  },
      { name: "track",         type: "string"  },  // "fullstack", "smart_contracts"
      { name: "graduatedAt",   type: "uint64"  },
      { name: "projectUri",    type: "string"  },  // IPFS CID to capstone project
    ],
  },
} as const;
```

**API routes** — `POST /api/v1/education/degree`, `POST /api/v1/education/course`,
`GET /api/v1/education/:address`

---

#### SERVICE 8 — Social Verification

Issuers: social platforms, OAuth bridges, Farcaster/Lens relayers.
Use cases: bot-resistance, sybil resistance, cross-platform identity linking,
social graph portability.

```typescript
export const SOCIAL_SCHEMAS = {

  SOCIAL_ACCOUNT: {
    name: "arcpass_social_account",
    version: "1.0.0",
    fields: [
      { name: "platform",    type: "string"  },  // "github", "x", "farcaster", "lens"
      { name: "handle",      type: "string"  },  // @username (no PII stored onchain)
      { name: "profileId",   type: "string"  },  // opaque platform ID
      { name: "verifiedAt",  type: "uint64"  },
    ],
  },

  HUMANITY_PROOF: {
    name: "arcpass_humanity",
    version: "1.0.0",
    fields: [
      { name: "verified",   type: "bool"    },
      { name: "mechanism",  type: "string"  },  // "worldcoin", "bright_id", "civic"
      { name: "nullifier",  type: "bytes32" },  // sybil-resistant unique identifier
      { name: "checkedAt",  type: "uint64"  },
    ],
  },

  FOLLOWER_MILESTONE: {
    name: "arcpass_follower_milestone",
    version: "1.0.0",
    fields: [
      { name: "platform",       type: "string"  },
      { name: "followerCount",  type: "uint32"  },
      { name: "milestone",      type: "uint32"  },  // 100, 1000, 10000 etc.
      { name: "verifiedAt",     type: "uint64"  },
    ],
  },
} as const;
```

**API routes** — `POST /api/v1/social/link`, `POST /api/v1/social/humanity`,
`GET /api/v1/social/:address`

---

#### SERVICE 9 — Custom / Open Registry

Any issuer may register custom schemas and issue claims not covered by services
1–8. The custom service provides no predefined schemas — it exposes the raw
`SchemaRegistry` and `AttestationRegistry` interface through the API and Studio UI.

This is the developer/enterprise tier. The ArcPass Studio `SchemaBuilder.tsx`
component is the primary interface for this service — issuers define fields
visually and register on-chain.

```typescript
// No predefined schemas — the service is schema-agnostic
export const CUSTOM_SCHEMAS = {} as const;

// CustomAttestationService.ts wraps the generic attest() path directly
// and validates only that the schemaId exists in SchemaRegistry
```

**API routes** — `POST /api/v1/custom/schema/register`, `POST /api/v1/custom/attest`,
`GET /api/v1/custom/claims/:address`, `GET /api/v1/custom/schema/:schemaId`

---

### 16.4 BaseAttestationService Pattern

All nine service classes extend a shared base. This eliminates code duplication
across Circle wallet calls, event emission, onchain validation, and error handling.

```typescript
// backend/src/services/attestation/base/BaseAttestationService.ts
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { circleClient }      from "../../config/circle";
import { publicClient }      from "../../services/arcService";
import { ATTESTATION_REGISTRY_ABI } from "../../abis/AttestationRegistry";
import { ADDRESSES }         from "../../config/arc";
import { Errors }            from "../../utils/errors";

export interface AttestInput {
  subject:   `0x${string}`;
  schemaId:  `0x${string}`;
  data:      `0x${string}`;   // ABI-encoded claim payload
  expiresAt: number;          // unix timestamp, 0 = no expiry
}

export abstract class BaseAttestationService {
  protected readonly serviceName: string;
  protected readonly walletId:    string;

  constructor(serviceName: string, walletId: string) {
    this.serviceName = serviceName;
    this.walletId    = walletId;
  }

  // ─── WRITE ────────────────────────────────────────────────────────────────

  async issue(input: AttestInput): Promise<`0x${string}`> {
    this._assertBlockchain();
    this._validateSubject(input.subject);

    const txId = await this._submitToCircle(
      "attest(address,bytes32,bytes,uint256)",
      [input.subject, input.schemaId, input.data, input.expiresAt.toString()]
    );

    return this._pollForHash(txId);
  }

  async revoke(claimId: `0x${string}`): Promise<`0x${string}`> {
    this._assertBlockchain();

    // Verify the claim exists and belongs to this service's issuer wallet
    await this._assertClaimExists(claimId);

    const txId = await this._submitToCircle(
      "revoke(bytes32)",
      [claimId]
    );

    return this._pollForHash(txId);
  }

  async batchIssue(inputs: AttestInput[]): Promise<{ claimIds: `0x${string}`[]; successes: boolean[] }> {
    if (inputs.length === 0 || inputs.length > 100) {
      throw Errors.InvalidBatchSize(inputs.length);
    }
    // Encodes inputs for BatchAttestation.batchAttest()
    const encoded = inputs.map(i => ({
      subject:          i.subject,
      schemaId:         i.schemaId,
      dataCommitment:   i.data,
      expiresAt:        BigInt(i.expiresAt),
    }));
    const txId = await this._submitToCircle(
      "batchAttest((address,bytes32,bytes32,uint256)[])",
      [encoded]
    );
    const txHash = await this._pollForHash(txId);
    // Decode return values from receipt logs
    return this._decodeBatchResult(txHash);
  }

  // ─── READ ─────────────────────────────────────────────────────────────────

  async verify(subject: `0x${string}`, schemaId: `0x${string}`) {
    return publicClient.readContract({
      address:      ADDRESSES.passportVerifier,
      abi:          ATTESTATION_REGISTRY_ABI,
      functionName: "verify",
      args:         [subject, schemaId],
    });
  }

  async getClaims(subject: `0x${string}`, schemaId: `0x${string}`) {
    return publicClient.readContract({
      address:      ADDRESSES.attestationRegistry,
      abi:          ATTESTATION_REGISTRY_ABI,
      functionName: "getActiveClaims",
      args:         [subject, schemaId],
    });
  }

  // ─── PRIVATE ──────────────────────────────────────────────────────────────

  private _assertBlockchain() {
    const expected = process.env.ARC_BLOCKCHAIN_ENV;
    if (!["ARC-TESTNET", "ARC-MAINNET"].includes(expected!)) {
      throw Errors.ChainMismatch("ARC-TESTNET or ARC-MAINNET", expected ?? "undefined");
    }
  }

  private _validateSubject(subject: string) {
    if (!subject || subject === "0x0000000000000000000000000000000000000000") {
      throw Errors.InvalidSubject(subject);
    }
  }

  private async _assertClaimExists(claimId: `0x${string}`) {
    const claim = await publicClient.readContract({
      address:      ADDRESSES.attestationRegistry,
      abi:          ATTESTATION_REGISTRY_ABI,
      functionName: "getClaim",
      args:         [claimId],
    });
    if (!claim || (claim as any).claimId === "0x" + "0".repeat(64)) {
      throw Errors.ClaimNotFound(claimId);
    }
  }

  private async _submitToCircle(
    abiFn:  string,
    params: unknown[]
  ): Promise<string> {
    const tx = await circleClient.createContractExecutionTransaction({
      walletId:             this.walletId,
      blockchain:           process.env.ARC_BLOCKCHAIN_ENV!,
      contractAddress:      ADDRESSES.attestationRegistry,
      abiFunctionSignature: abiFn,
      abiParameters:        params as string[],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
    if (!tx.data?.id) throw Errors.TransactionFailed(abiFn, "No transaction ID returned");
    return tx.data.id;
  }

  private async _pollForHash(txId: string): Promise<`0x${string}`> {
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      const { data } = await circleClient.getTransaction({ id: txId });
      const state    = data?.transaction?.state;
      if (state === "COMPLETE") return data!.transaction!.txHash as `0x${string}`;
      if (state === "FAILED")   throw Errors.TransactionFailed("pollForHash", `tx ${txId} FAILED`);
    }
    throw Errors.TransactionFailed("pollForHash", `tx ${txId} timed out after 18s`);
  }

  private async _decodeBatchResult(txHash: `0x${string}`) {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    // Parse BatchIssued event logs — extract claimIds and successes arrays
    const batchLog = receipt.logs.find(
      l => l.topics[0] === "0x" /* BatchIssued event topic */
    );
    if (!batchLog) return { claimIds: [], successes: [] };
    const decoded = decodeEventLog({
      abi:     ATTESTATION_REGISTRY_ABI,
      data:    batchLog.data,
      topics:  batchLog.topics,
      eventName: "BatchIssued",
    });
    return { claimIds: (decoded as any).claimIds, successes: (decoded as any).successes };
  }
}
```

Each service class then only implements its own encoding logic:

```typescript
// backend/src/services/attestation/kyc/KycAttestationService.ts
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { BaseAttestationService } from "../base/BaseAttestationService";
import { KYC_SCHEMAS }           from "../../../constants/schemas";

export class KycAttestationService extends BaseAttestationService {
  constructor() {
    super("kyc", process.env.CIRCLE_KYC_ISSUER_WALLET_ID!);
  }

  async issueBasicKyc(
    subject:   `0x${string}`,
    level:     number,
    country:   string,
    provider:  string,
    expiresAt: number
  ) {
    const data = encodeAbiParameters(
      parseAbiParameters("uint8 level, string country, string provider, uint64 checkedAt"),
      [level, country, provider, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId: KYC_SCHEMAS.KYC_BASIC.id as `0x${string}`,
      data,
      expiresAt,
    });
  }

  async issueAmlScreening(
    subject:  `0x${string}`,
    passed:   boolean,
    provider: string
  ) {
    const data = encodeAbiParameters(
      parseAbiParameters("bool passed, string provider, uint64 checkedAt"),
      [passed, provider, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId:  KYC_SCHEMAS.AML_SCREENING.id as `0x${string}`,
      data,
      expiresAt: 0,
    });
  }
}
```

The same pattern applies to all nine service classes — only the ABI parameter
encoding and schema IDs differ. No service class duplicates Circle wallet
polling, chain assertion, or error wrapping logic.

---

### 16.5 Service Registry — runtime routing

```typescript
// backend/src/services/attestation/index.ts
import { IdentityAttestationService }    from "./identity/IdentityAttestationService";
import { KycAttestationService }         from "./kyc/KycAttestationService";
import { CredentialAttestationService }  from "./credentials/CredentialAttestationService";
import { DaoAttestationService }         from "./dao/DaoAttestationService";
import { ReputationAttestationService }  from "./reputation/ReputationAttestationService";
import { EmploymentAttestationService }  from "./employment/EmploymentAttestationService";
import { EducationAttestationService }   from "./education/EducationAttestationService";
import { SocialAttestationService }      from "./social/SocialAttestationService";
import { CustomAttestationService }      from "./custom/CustomAttestationService";

export type ServiceKey =
  | "identity" | "kyc" | "credentials" | "dao"
  | "reputation" | "employment" | "education" | "social" | "custom";

const registry = {
  identity:    new IdentityAttestationService(),
  kyc:         new KycAttestationService(),
  credentials: new CredentialAttestationService(),
  dao:         new DaoAttestationService(),
  reputation:  new ReputationAttestationService(),
  employment:  new EmploymentAttestationService(),
  education:   new EducationAttestationService(),
  social:      new SocialAttestationService(),
  custom:      new CustomAttestationService(),
} as const satisfies Record<ServiceKey, BaseAttestationService>;

export function getService(key: ServiceKey) {
  return registry[key];
}
```

Route files import from this registry — they never instantiate services directly.

---

### 16.6 Extended Passport Aggregation

`GET /api/v1/passport/:address` now aggregates across all nine services:

```typescript
// backend/src/services/passportService.ts (extended)
export interface PassportDocument {
  address:     string;
  identityId:  number;
  metadata:    IdentityMetadata;
  reputation:  ReputationEvent[];
  services: {
    identity:    ServiceClaims;
    kyc:         ServiceClaims;
    credentials: ServiceClaims;
    dao:         ServiceClaims;
    reputation:  ServiceClaims;
    employment:  ServiceClaims;
    education:   ServiceClaims;
    social:      ServiceClaims;
    custom:      ServiceClaims;
  };
  generatedAt:  number;
}

export interface ServiceClaims {
  service:    ServiceKey;
  claims:     ActiveClaim[];
  verified:   boolean;       // true if any valid claim exists for this service
  claimCount: number;
}
```

Aggregation fetches all services in parallel using `Promise.allSettled` — one
service timing out does not break the entire passport response:

```typescript
async function buildPassportFromChain(address: `0x${string}`): Promise<PassportDocument> {
  const serviceKeys: ServiceKey[] = [
    "identity", "kyc", "credentials", "dao",
    "reputation", "employment", "education", "social", "custom"
  ];

  const results = await Promise.allSettled(
    serviceKeys.map(key => getService(key).getClaims(address, /* all schemas */ null))
  );

  const services = Object.fromEntries(
    serviceKeys.map((key, i) => [
      key,
      {
        service:    key,
        claims:     results[i].status === "fulfilled" ? results[i].value : [],
        verified:   results[i].status === "fulfilled" && results[i].value.length > 0,
        claimCount: results[i].status === "fulfilled" ? results[i].value.length : 0,
      }
    ])
  ) as PassportDocument["services"];

  return { address, services, generatedAt: Date.now(), ...identityData };
}
```

---

### 16.7 ArcPass Studio — Frontend for Multi-Service Issuance

The Studio is the issuer-facing interface. Regular end-users never see it —
they only see their passport and the service-specific claim badges on
`/passport/:address`.

#### Studio navigation structure

```
ArcPass Studio (/studio)
├── Overview             — issuer stats across all services
├── Schema Builder       — visual field builder for custom schemas
├── Schema Templates     — pre-built schemas for each service
├── Issue Credential     — select service → select schema → fill form → sign → submit
├── Bulk Issue           — CSV upload → batch attestation
├── Revoke Manager       — search by address or claimId → revoke
├── Analytics            — per-service issuance volume, revocations, expiry warnings
└── Settings             — issuer wallet info, role status, API key management
```

#### SchemaBuilder.tsx field types

The visual builder must support every type defined in the schemas above:

```typescript
// frontend/src/components/studio/FieldBuilder.tsx
export const SUPPORTED_FIELD_TYPES = [
  { value: "bool",    label: "Boolean (true/false)"       },
  { value: "uint8",   label: "Small number (0–255)"       },
  { value: "uint16",  label: "Medium number (0–65535)"    },
  { value: "uint32",  label: "Number (0–4B)"              },
  { value: "uint64",  label: "Timestamp / large number"   },
  { value: "uint256", label: "Large number / token amount" },
  { value: "string",  label: "Text"                       },
  { value: "address", label: "Wallet address"             },
  { value: "bytes32", label: "Hash / identifier"          },
  { value: "address[]", label: "List of addresses"        },
] as const;
```

#### Schema templates map

```typescript
// frontend/src/components/studio/SchemaTemplates.tsx
export const SCHEMA_TEMPLATES: Record<ServiceKey, SchemaTemplate[]> = {
  kyc:         [KYC_BASIC_TEMPLATE, AML_SCREENING_TEMPLATE, AGE_OVER_18_TEMPLATE],
  credentials: [CERTIFICATION_TEMPLATE, LICENSE_TEMPLATE, SKILL_TEMPLATE],
  dao:         [DAO_MEMBERSHIP_TEMPLATE, GOVERNANCE_TEMPLATE],
  reputation:  [REPUTATION_SCORE_TEMPLATE, INTERACTION_TEMPLATE],
  employment:  [EMPLOYMENT_TEMPLATE, INCOME_BAND_TEMPLATE],
  education:   [DEGREE_TEMPLATE, COURSE_TEMPLATE],
  social:      [SOCIAL_ACCOUNT_TEMPLATE, HUMANITY_PROOF_TEMPLATE],
  identity:    [BASIC_IDENTITY_TEMPLATE, LIVENESS_TEMPLATE],
  custom:      [],
};
```

---

### 16.8 Per-Service Wallet IDs

Each service should use its own Circle issuer wallet for gas and audit separation.
Add these to backend `.env`:

```bash
# Per-service Circle issuer wallet IDs
CIRCLE_IDENTITY_ISSUER_WALLET_ID=
CIRCLE_KYC_ISSUER_WALLET_ID=
CIRCLE_CREDENTIALS_ISSUER_WALLET_ID=
CIRCLE_DAO_ISSUER_WALLET_ID=
CIRCLE_REPUTATION_ISSUER_WALLET_ID=
CIRCLE_EMPLOYMENT_ISSUER_WALLET_ID=
CIRCLE_EDUCATION_ISSUER_WALLET_ID=
CIRCLE_SOCIAL_ISSUER_WALLET_ID=
CIRCLE_CUSTOM_ISSUER_WALLET_ID=
```

This enables:
- Independent gas balance monitoring per service
- Service-level audit logs (which wallet issued which claim)
- Granular key rotation if one service is compromised (does not affect others)
- Future: per-service pricing / USDC fee collection

---

### 16.9 Agent Routing for Multi-Service Work

When the Architect receives a task that touches the attestation service layer,
it must identify which of the nine services is involved and route work accordingly.

```
Task mentions "KYC", "AML", "compliance", "age gate"
  → Architect plans KycAttestationService changes
  → Implementer touches backend/src/services/attestation/kyc/ only
  → Tester adds tests for KYC-specific encoding / edge cases

Task mentions "DAO", "governance", "voting", "delegate"
  → Architect plans DaoAttestationService + DaoMembershipGate changes
  → Implementer touches contracts/src/services/verifiers/DaoMembershipGate.sol
    AND backend/src/services/attestation/dao/

Task mentions "schema", "custom fields", "field builder", "template"
  → Architect confirms it is a SchemaRegistry or Studio task
  → Implementer touches frontend/src/components/studio/ or SchemaRegistry.sol

Task mentions "passport" without specifying a service
  → Assume passportService.ts aggregation task
  → Implementer touches backend/src/services/passportService.ts only
  → Does NOT touch individual service classes unless explicitly scoped
```

No agent may modify more than one service's files in a single task unless
the Architect has explicitly approved a cross-service change in a PLAN document.
Cross-service changes are high-risk because a bug in `BaseAttestationService`
affects all nine services simultaneously.

---

*Attestation Service Expansion — ArcPass v2.0*
*Nine services. One contract. Zero compromises.*
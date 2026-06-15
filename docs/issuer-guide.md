# Issuer Guide

## Becoming an Issuer

1. Deploy ArcPass contracts
2. Have the admin (DEFAULT_ADMIN_ROLE) grant your address ISSUER_ROLE:
   ```
   registry.grantRole(ISSUER_ROLE, your_address)
   ```
3. Register your claim schemas via SchemaRegistry

## Issuing Claims

### Via Smart Contract (direct call)

```solidity
bytes32 claimId = attestationRegistry.attest(
    subject,     // address — the claim recipient
    schemaId,    // bytes32 — registered schema ID
    dataCommitment, // bytes32 — Merkle root of claim fields
    expiresAt    // uint256 — 0 = never expires
);
```

### Via Backend API

```bash
curl -X POST /attestation/attest \
  -H "x-wallet-address: 0x..." \
  -H "x-signature: 0x..." \
  -H "x-nonce: uuid" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "0x...",
    "schemaId": "0x...",
    "data": "0x...",
    "expiresAt": 0
  }'
```

## Revoking Claims

```solidity
attestationRegistry.revoke(claimId);
```

## Best Practices

1. Always verify the subject has consented to the claim
2. Store raw claim data off-chain (IPFS) encrypted
3. Only commit the Merkle root on-chain
4. Set reasonable expiry dates for time-sensitive claims
5. Never issue claims that violate GDPR or local regulations

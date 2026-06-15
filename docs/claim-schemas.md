# Claim Schema Registry

## Field Classification

Every field in a claim schema must be classified as:

| Classification | Description | Display |
|---------------|-------------|---------|
| PUBLIC | May appear in GET /passport/:address response | Visible |
| PRIVATE | Disclosed only via subject-signed request + Merkle proof | Hidden |
| DERIVED | Computed on-demand, never stored | N/A |

## Standard Schemas

### kyc_basic (v1.0.0)

```json
{
  "name": "kyc_basic",
  "version": "1.0.0",
  "fields": [
    { "name": "level", "type": "uint8", "classification": "PUBLIC" },
    { "name": "country", "type": "string", "classification": "PUBLIC" },
    { "name": "provider", "type": "address", "classification": "PUBLIC" }
  ]
}
```

### professional (v1.0.0)

```json
{
  "name": "professional",
  "version": "1.0.0",
  "fields": [
    { "name": "title", "type": "string", "classification": "PUBLIC" },
    { "name": "organization", "type": "string", "classification": "PUBLIC" },
    { "name": "verified", "type": "bool", "classification": "PUBLIC" }
  ]
}
```

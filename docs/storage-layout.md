# Storage Layout — ArcPass V1

## AttestationRegistry

Slot layout (UUPS proxy, `_disableInitializers()` set):

| Slot Range | Variable | Type | Notes |
|---|---|---|---|
| 0-49 | AccessControlUpgradeable | inherited | OZ standard layout |
| 50 | `schemaRegistry` | `ISchemaRegistry` | Address (1 slot) |
| 51 | `_claimNonce` | `uint256` | Monotonic counter |
| 52 | `_issuerList.length` | `uint256` | Dynamic array length |
| 53+ | `_issuerList[0..N]` | `address[]` | Dynamic array elements |
| mapping | `_isIssuer` | `mapping(address => bool)` | No physical slot |
| mapping | `_claims` | `mapping(bytes32 => Claim)` | No physical slot |
| mapping | `_activeClaim` | `mapping(address => mapping(bytes32 => mapping(address => bytes32)))` | No physical slot |
| 54-99 | `__gap[46]` | `uint256[46]` | Reserved for future V2+ |

**V1 -> V2 migration**: Append after `__gap`, reduce gap count by slots added.

---

## SchemaRegistry

| Slot Range | Variable | Type | Notes |
|---|---|---|---|
| 0-49 | AccessControlUpgradeable | inherited | OZ standard layout |
| mapping | `_schemas` | `mapping(bytes32 => Schema)` | No physical slot |
| mapping | `_registered` | `mapping(bytes32 => bool)` | No physical slot |
| 50 | `_schemaList.length` | `uint256` | Dynamic array length |
| 51+ | `_schemaList[0..N]` | `bytes32[]` | Dynamic array elements |
| 52-99 | `__gap[48]` | `uint256[48]` | Reserved for future |

---

## Migration Safety Rules

1. **Never** reorder existing state variables between versions.
2. **Never** change the type of an existing state variable.
3. **Only** append new state variables at the end, before `__gap`.
4. **Reduce `__gap`** by the number of new slots consumed.
5. Mappings and dynamic arrays do **not** consume `__gap` slots — only value types do.

---

## Upgrade Verification

Before any upgrade, run:

```bash
forge inspect AttestationRegistry storage-layout --json > v1-layout.json
# ... deploy new implementation ...
forge inspect AttestationRegistryV2 storage-layout --json > v2-layout.json
diff v1-layout.json v2-layout.json
```

Any slot reordering is a **Critical** block on the upgrade.

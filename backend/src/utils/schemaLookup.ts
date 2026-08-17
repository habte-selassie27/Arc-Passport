/**
 * Shared schema lookup against the canonical schema catalog.
 *
 * `backend/src/constants/schemas.ts` is the single source of truth for schema
 * definitions (per AGENTS.md §6 — the same `fieldsJson` must compute schema IDs
 * on-chain and off-chain). This helper resolves a schemaId back to its name.
 */
import { ALL_SCHEMAS } from "../constants/schemas.js";

export interface SchemaInfo {
  id:   `0x${string}`;
  name: string;
  service: string;
}

/** All registered schemas as a flat list (id + name + owning service). */
export function listAllSchemas(): SchemaInfo[] {
  const out: SchemaInfo[] = [];
  for (const [service, defs] of Object.entries(ALL_SCHEMAS)) {
    for (const def of Object.values(defs as Record<string, { id?: `0x${string}`; name: string }>)) {
      if (def.id) out.push({ id: def.id, name: def.name, service });
    }
  }
  return out;
}

/** Resolve a schemaId (case-insensitive) to its canonical definition, or null. */
export function resolveSchema(schemaId: string): SchemaInfo | null {
  const key = schemaId.toLowerCase();
  return listAllSchemas().find((s) => s.id.toLowerCase() === key) ?? null;
}

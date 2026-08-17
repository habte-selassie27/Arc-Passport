import { keccak256, encodePacked } from "viem";
import { SCHEMA_TEMPLATES } from "../components/studio/SchemaTemplates";
import type { ServiceKey } from "../types/passport";

export interface SchemaOption {
  label: string;
  service: string;
  schemaId: string;
}

/** All template schemas with their deterministic schema IDs (name + version + fields). */
export const PRESET_SCHEMAS: SchemaOption[] = (
  Object.entries(SCHEMA_TEMPLATES) as [ServiceKey, typeof SCHEMA_TEMPLATES[ServiceKey]][]
).flatMap(([service, templates]) =>
  templates.map((t) => ({
    label: `${t.name} v${t.version}`,
    service,
    schemaId: keccak256(
      encodePacked(
        ["string", "string", "string"],
        [
          t.name,
          t.version,
          JSON.stringify(t.fields.map((f: { name: string; type: string }) => ({ name: f.name, type: f.type }))),
        ]
      )
    ),
  }))
);

const SCHEMA_ID_TO_LABEL = new Map(PRESET_SCHEMAS.map((s) => [s.schemaId.toLowerCase(), s.label]));

/** Human-readable schema name for a schema ID, or a truncated hex fallback. */
export function schemaNameForId(schemaId: string): string {
  return SCHEMA_ID_TO_LABEL.get(schemaId.toLowerCase()) ?? `${schemaId.slice(0, 14)}...`;
}

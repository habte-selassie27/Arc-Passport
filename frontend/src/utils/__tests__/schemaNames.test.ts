import { describe, it, expect } from "vitest";
import { keccak256, encodePacked } from "viem";
import { PRESET_SCHEMAS, schemaNameForId } from "../schemaNames";
import { SCHEMA_TEMPLATES } from "../../components/studio/SchemaTemplates";

describe("schemaNames", () => {
  it("generates a preset schema for every service with templates (custom has none)", () => {
    const servicesWithTemplates = (Object.keys(SCHEMA_TEMPLATES) as (keyof typeof SCHEMA_TEMPLATES)[]).filter(
      (s) => SCHEMA_TEMPLATES[s].length > 0
    );
    const servicesCovered = new Set(PRESET_SCHEMAS.map((s) => s.service));
    for (const service of servicesWithTemplates) {
      expect(servicesCovered.has(service)).toBe(true);
    }
  });

  it("computes deterministic schema IDs matching keccak256(name, version, fieldsJson)", () => {
    for (const preset of PRESET_SCHEMAS) {
      const template = SCHEMA_TEMPLATES[preset.service as keyof typeof SCHEMA_TEMPLATES].find(
        (t) => `${t.name} v${t.version}` === preset.label
      )!;
      const expected = keccak256(
        encodePacked(
          ["string", "string", "string"],
          [
            template.name,
            template.version,
            JSON.stringify(template.fields.map((f) => ({ name: f.name, type: f.type }))),
          ]
        )
      );
      expect(preset.schemaId).toBe(expected);
    }
  });

  it("returns the human-readable label for a known schema ID", () => {
    const preset = PRESET_SCHEMAS.find((s) => s.label.startsWith("arcpass_kyc_basic"))!;
    expect(schemaNameForId(preset.schemaId)).toBe("arcpass_kyc_basic v3.0.0");
  });

  it("is case-insensitive when looking up a schema ID", () => {
    const preset = PRESET_SCHEMAS.find((s) => s.label.startsWith("arcpass_identity"))!;
    expect(schemaNameForId(preset.schemaId.toUpperCase())).toBe(preset.label);
  });

  it("truncates unknown schema IDs instead of returning them in full", () => {
    const unknown = `0x${"ab".repeat(32)}`;
    expect(schemaNameForId(unknown)).toBe(`${unknown.slice(0, 14)}...`);
  });
});

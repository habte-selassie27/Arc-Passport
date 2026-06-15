import { describe, it, expect } from "vitest";
import { buildOpenApiDocument } from "../../openapi/registry.js";

describe("OpenAPI spec generation", () => {
  it("generates a valid OpenAPI 3.1 document", () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("ArcPass API");
    expect(doc.info.version).toBeDefined();
    expect(doc.servers?.length).toBeGreaterThan(0);
  });

  it("registers all 9 service tags", () => {
    const doc = buildOpenApiDocument();
    const tagNames = (doc.tags ?? []).map((t) => t.name);
    for (const t of ["Identity", "KYC / Compliance", "Credentials", "DAO", "Reputation", "Employment", "Education", "Social", "Custom Schemas"]) {
      expect(tagNames).toContain(t);
    }
  });

  it("registers paths for all 9 services", () => {
    const doc = buildOpenApiDocument();
    const paths = Object.keys(doc.paths ?? {});
    for (const prefix of ["/v1/identity", "/v1/kyc", "/v1/credentials", "/v1/dao", "/v1/reputation", "/v1/employment", "/v1/education", "/v1/social", "/v1/custom"]) {
      expect(paths.some((p) => p.startsWith(prefix))).toBe(true);
    }
    expect(paths.some((p) => p.startsWith("/v1/bulk"))).toBe(true);
    expect(paths.some((p) => p.startsWith("/v1/passport"))).toBe(true);
  });

  it("registers common response schemas as components", () => {
    const doc = buildOpenApiDocument();
    const schemas = doc.components?.schemas ?? {};
    expect(schemas.ErrorResponse).toBeDefined();
    expect(schemas.TxResponse).toBeDefined();
    expect(schemas.SimpleResponse).toBeDefined();
  });

  it("registers all service body schemas as components", () => {
    const doc = buildOpenApiDocument();
    const schemas = doc.components?.schemas ?? {};
    const required = [
      "RegisterIdentityBody", "LivenessBody",
      "BasicKycBody", "AmlBody", "AccreditedBody", "AgeGateBody",
      "CertifyBody", "LicenseBody", "EndorseBody",
      "EnrollBody", "ParticipationBody", "DelegateBody",
      "RecordReputationBody", "InteractionBody", "DisputeBody",
      "IssueEmploymentBody", "IncomeBody", "ContractorBody",
      "DegreeBody", "CourseBody", "BootcampBody",
      "LinkAccountBody", "HumanityBody", "FollowerMilestoneBody",
      "RegisterSchemaBody", "CustomAttestBody",
      "BulkJsonBody", "BulkCsvBody", "BulkResponseData",
    ];
    for (const s of required) {
      expect(schemas[s]).toBeDefined();
    }
  });

  it("every POST path has a requestBody and a 200 response", () => {
    const doc = buildOpenApiDocument();
    for (const [path, methods] of Object.entries(doc.paths ?? {})) {
      for (const [method, op] of Object.entries(methods)) {
        if (method.toLowerCase() === "post") {
          expect(op.requestBody, `${method.toUpperCase()} ${path} missing requestBody`).toBeDefined();
          expect(op.responses["200"], `${method.toUpperCase()} ${path} missing 200 response`).toBeDefined();
        }
      }
    }
  });

  it("every path has a summary and at least one tag", () => {
    const doc = buildOpenApiDocument();
    for (const [path, methods] of Object.entries(doc.paths ?? {})) {
      for (const [method, op] of Object.entries(methods)) {
        expect(op.summary, `${method.toUpperCase()} ${path} missing summary`).toBeTruthy();
        expect(op.tags?.length ?? 0, `${method.toUpperCase()} ${path} missing tags`).toBeGreaterThan(0);
      }
    }
  });

  it("every referenced component schema exists in components", () => {
    const doc = buildOpenApiDocument();
    const schemas = doc.components?.schemas ?? {};
    const refPattern = /#\/components\/schemas\/(\w+)/g;
    const refs = new Set<string>();
    const visit = (node: unknown) => {
      if (node == null) return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (typeof node !== "object") return;
      const rec = node as Record<string, unknown>;
      if (typeof rec["$ref"] === "string") {
        const m = (rec["$ref"] as string).match(refPattern);
        if (m) m.forEach((r) => refs.add(r.replace("#/components/schemas/", "")));
      }
      for (const v of Object.values(rec)) visit(v);
    };
    visit(doc);
    for (const ref of refs) {
      expect(schemas[ref], `missing component schema "${ref}"`).toBeDefined();
    }
  });
});

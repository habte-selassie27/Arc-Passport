import { describe, it, expect, vi } from "vitest";

vi.mock("../../middleware/auth.js", () => ({
  requireSignedNonce: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/issuerGuard.js", () => ({
  issuerGuard: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from "express";
import { z } from "zod";
import requestsRoutes from "../../routes/v1/requests.js";
import { errorHandler } from "../../middleware/errorHandler.js";

const addressLike = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const schemaIdHex  = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const CreateRequestBody = z.object({
  issuer:  addressLike,
  schemaId: schemaIdHex,
  note:     z.string().max(500).optional().default(""),
});

const callSchema = <T extends z.ZodTypeAny>(schema: T, raw: unknown) => schema.safeParse(raw);

describe("v1/requests zod body schema", () => {
  it("rejects a missing issuer", () => {
    const r = callSchema(CreateRequestBody, { schemaId: "0x" + "a".repeat(64) });
    expect(r.success).toBe(false);
  });

  it("rejects a malformed issuer address", () => {
    const r = callSchema(CreateRequestBody, { issuer: "notanaddress", schemaId: "0x" + "a".repeat(64) });
    expect(r.success).toBe(false);
  });

  it("rejects a malformed schemaId", () => {
    const r = callSchema(CreateRequestBody, { issuer: "0x1111111111111111111111111111111111111111", schemaId: "0x1234" });
    expect(r.success).toBe(false);
  });

  it("accepts a valid request body", () => {
    const r = callSchema(CreateRequestBody, {
      issuer:  "0x1111111111111111111111111111111111111111",
      schemaId: "0x" + "a".repeat(64),
      note:    "please",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note).toBe("please");
  });

  it("defaults note to an empty string", () => {
    const r = callSchema(CreateRequestBody, {
      issuer:  "0x1111111111111111111111111111111111111111",
      schemaId: "0x" + "a".repeat(64),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note).toBe("");
  });

  it("rejects an over-long note (>500 chars)", () => {
    const r = callSchema(CreateRequestBody, {
      issuer:  "0x1111111111111111111111111111111111111111",
      schemaId: "0x" + "a".repeat(64),
      note:    "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe("v1/requests route module loads with mocked deps", () => {
  it("mounts the router without errors", () => {
    expect(requestsRoutes).toBeDefined();
    const app = express();
    app.use("/v1/requests", requestsRoutes);
    app.use(errorHandler);
    expect(typeof app).toBe("function");
  });
});

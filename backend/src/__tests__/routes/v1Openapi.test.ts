import { describe, it, expect } from "vitest";
import { buildOpenApiDocument } from "../../openapi/registry.js";
import express from "express";
import { Router, type Request, type Response } from "express";

describe("/v1/openapi.json route (smoke test)", () => {
  it("buildOpenApiDocument produces a valid 3.1 doc", () => {
    const d = buildOpenApiDocument();
    expect(d.openapi).toBe("3.1.0");
    expect(d.info.title).toBe("ArcPass API");
    expect(Object.keys(d.paths ?? {}).length).toBeGreaterThan(0);
  });

  it("openapiRoutes module can be loaded (smoke)", () => {
    const router = Router();
    router.get("/openapi.json", (_req: Request, res: Response) => {
      const doc = buildOpenApiDocument();
      res.json(doc);
    });
    const app = express();
    app.use("/v1", router);
    expect(typeof app).toBe("function");
  });
});

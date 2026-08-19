import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";

// Mock the signed-auth + issuer middlewares so public GET routes are testable
// without a wallet signature (same pattern as the other route tests).
vi.mock("../../middleware/auth.js", () => ({
  requireSignedNonce: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../middleware/issuerGuard.js", () => ({
  issuerGuard: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import serviceRoutesV1 from "../../routes/v1/service.js";
import bulkRoutesV1 from "../../routes/v1/bulk.js";
import analyticsRoutesV1 from "../../routes/v1/analytics.js";
import settingsRoutesV1 from "../../routes/v1/settings.js";
import notificationsRoutesV1 from "../../routes/v1/notifications.js";
import requestsRoutesV1 from "../../routes/v1/requests.js";
import { errorHandler } from "../../middleware/errorHandler.js";

/**
 * Mirrors the mount order in src/index.ts. The specific /v1/* routers MUST be
 * mounted before serviceRoutesV1 — it registers catch-all patterns like
 * GET /:service/schemas that would otherwise shadow GET /v1/requests/schemas
 * with a 400 INVALID_SERVICE.
 */
function buildApp() {
  const app = express();
  app.use(express.json());

  app.use("/v1/bulk", bulkRoutesV1);
  app.use("/v1/analytics", analyticsRoutesV1);
  app.use("/v1/settings", settingsRoutesV1);
  app.use("/v1/notifications", notificationsRoutesV1);
  app.use("/v1/requests", requestsRoutesV1);
  app.use("/v1", serviceRoutesV1);

  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.originalUrl}` },
    });
  });
  app.use(errorHandler);

  return app;
}

const app = buildApp();
let server: Server;
let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("failed to bind test server");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => {
  server?.close();
});

describe("v1 router mount order (regression)", () => {
  it("GET /v1/requests/schemas returns the catalog, not INVALID_SERVICE", async () => {
    const res = await fetch(`${baseUrl}/v1/requests/schemas`);
    const body = (await res.json()) as { success: boolean; data?: { schemas: unknown[] } };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data?.schemas)).toBe(true);
    expect((body.data?.schemas ?? []).length).toBeGreaterThan(0);
  });

  it("GET /v1/kyc/schemas still reaches the service router", async () => {
    const res = await fetch(`${baseUrl}/v1/kyc/schemas`);
    const body = (await res.json()) as { success: boolean; data?: { service: string } };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.service).toBe("kyc");
  });

  it("unknown routes return the JSON 404 envelope, never HTML", async () => {
    const res = await fetch(`${baseUrl}/verify/0xabc`);
    const body = (await res.json()) as { success: boolean; error?: { code: string } };
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe("NOT_FOUND");
  });
});

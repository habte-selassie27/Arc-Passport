/**
 * Tests for the developer verification API endpoint.
 *
 * Covers:
 * - GET /v1/verify/:address — single address verification
 * - POST /v1/verify/batch — batch verification
 * - Query parameter validation (policy, threshold, breakdown)
 * - Error handling for invalid addresses, missing params
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import verifyRouter from "../../routes/v1/verify.js";

// ─── Test App Setup ──────────────────────────────────────────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/v1/verify", verifyRouter);
  return app;
}

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createTestApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://localhost:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ─── Helper ──────────────────────────────────────────────────────────────

async function fetchJson(path: string, options?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, options);
  return { status: res.status, body: await res.json() };
}

// ─── GET /v1/verify/:address Tests ────────────────────────────────────────

describe("GET /v1/verify/:address", () => {
  it("should reject invalid addresses", async () => {
    const { status, body } = await fetchJson("/v1/verify/not-an-address");

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_ADDRESS");
  });

  it("should reject addresses with wrong length", async () => {
    const { status, body } = await fetchJson("/v1/verify/0x123");

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_ADDRESS");
  });

  it("should accept valid address format", async () => {
    const address = "0x04e0353B7218b66D6803725ce7342E6e1225DB1b";
    const { status, body } = await fetchJson(`/v1/verify/${address}`);

    // May fail due to RPC, but should not fail due to validation
    expect(status).not.toBe(400);
    expect(body.success !== false || body.error?.code !== "INVALID_ADDRESS").toBe(true);
  });

  it("should reject invalid query parameters", async () => {
    const address = "0x04e0353B7218b66D6803725ce7342E6e1225DB1b";
    const { status, body } = await fetchJson(
      `/v1/verify/${address}?policy=invalid-policy`
    );

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_PARAMS");
  });

  it("should accept valid policy parameter", async () => {
    const address = "0x04e0353B7218b66D6803725ce7342E6e1225DB1b";
    const { status } = await fetchJson(
      `/v1/verify/${address}?policy=high-security`
    );

    // Should not fail on parameter validation
    expect(status).not.toBe(400);
  });

  it("should accept threshold parameter", async () => {
    const address = "0x04e0353B7218b66D6803725ce7342E6e1225DB1b";
    const { status } = await fetchJson(
      `/v1/verify/${address}?threshold=30`
    );

    expect(status).not.toBe(400);
  });

  it("should reject threshold out of range", async () => {
    const address = "0x04e0353B7218b66D6803725ce7342E6e1225DB1b";
    const { status, body } = await fetchJson(
      `/v1/verify/${address}?threshold=150`
    );

    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("should accept breakdown parameter", async () => {
    const address = "0x04e0353B7218b66D6803725ce7342E6e1225DB1b";
    const { status } = await fetchJson(
      `/v1/verify/${address}?breakdown=true`
    );

    expect(status).not.toBe(400);
  });
});

// ─── POST /v1/verify/batch Tests ─────────────────────────────────────────

describe("POST /v1/verify/batch", () => {
  it("should reject missing addresses", async () => {
    const { status, body } = await fetchJson("/v1/verify/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("MISSING_ADDRESSES");
  });

  it("should reject empty addresses array", async () => {
    const { status, body } = await fetchJson("/v1/verify/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: [] }),
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("MISSING_ADDRESSES");
  });

  it("should reject more than 50 addresses", async () => {
    const addresses = Array.from({ length: 51 }, (_, i) =>
      `0x${i.toString(16).padStart(40, "0")}`
    );

    const { status, body } = await fetchJson("/v1/verify/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses }),
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("TOO_MANY_ADDRESSES");
  });

  it("should reject invalid addresses in batch", async () => {
    const { status, body } = await fetchJson("/v1/verify/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: ["not-valid", "also-not-valid"] }),
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_ADDRESSES");
  });

  it("should accept valid batch request", async () => {
    const addresses = [
      "0x04e0353B7218b66D6803725ce7342E6e1225DB1b",
      "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD3e",
    ];

    const { status, body } = await fetchJson("/v1/verify/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses, policy: "default" }),
    });

    // May fail due to RPC, but should not fail on validation
    expect(status).not.toBe(400);
    expect(body.success !== false || body.error?.code !== "INVALID_ADDRESSES").toBe(true);
  });

  it("should accept policy and threshold in batch", async () => {
    const addresses = ["0x04e0353B7218b66D6803725ce7342E6e1225DB1b"];

    const { status } = await fetchJson("/v1/verify/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addresses,
        policy: "high-security",
        threshold: 50,
      }),
    });

    expect(status).not.toBe(400);
  });
});

// ─── Error Response Format Tests ──────────────────────────────────────────

describe("error response format", () => {
  it("should return consistent error envelope", async () => {
    const { body } = await fetchJson("/v1/verify/not-valid");

    expect(body).toHaveProperty("success", false);
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code");
    expect(body.error).toHaveProperty("message");
  });

  it("should include hint in error responses", async () => {
    const { body } = await fetchJson("/v1/verify/not-valid");

    expect(body.error).toHaveProperty("hint");
    expect(typeof body.error.hint).toBe("string");
  });
});

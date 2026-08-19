import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";

// Mock the service layer (NOT the route)
vi.mock("../../services/primusService.js", () => ({
  startVerification: vi.fn(async (subject: string, templateId: string) => ({
    verificationId: "vid-1",
    authUrl: "https://mock-primus.example.com/auth",
  })),
  handleCallback: vi.fn(async () => ({
    verificationId: "vid-1",
    state: "complete",
    templateId: "github-account",
    claimId: "0xclaim",
    txHash: "0xtx",
  })),
  getVerification: vi.fn(() => ({
    verificationId: "vid-1",
    subject: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    state: "initialized",
    templateId: "github-account",
  })),
  getWeb2ProofStatus: vi.fn(async () => ({
    subject: "0xabc",
    verified: false,
    isHolder: false,
  })),
}));

import web2ProofRoutes from "../../routes/web2-proof.js";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/web2-proof", web2ProofRoutes);
  return app;
}

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createTestApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

async function signed(path: string, method = "GET", body?: unknown) {
  const nonce = crypto.randomUUID();
  const message = `ArcPass:${path}:${nonce}`;
  const signature = await account.signMessage({ message });
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": account.address,
      "x-nonce": nonce,
      "x-signature": signature as `0x${string}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

describe("GET /web2-proof/config", () => {
  it("returns the web2 proof templates", async () => {
    const res = await fetch(`${baseUrl}/web2-proof/config`);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.provider).toBe("primus");
    expect(json.data.templates).toBeInstanceOf(Array);
    expect(json.data.templates.length).toBeGreaterThan(0);
  });
});

describe("GET /web2-proof/verify/:address", () => {
  it("returns verification status", async () => {
    const res = await fetch(`${baseUrl}/web2-proof/verify/0x1111111111111111111111111111111111111111`);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.verified).toBe(false);
  });
});

describe("Authenticated /web2-proof endpoints", () => {
  it("rejects unauthenticated POST /start with 401", async () => {
    const res = await fetch(`${baseUrl}/web2-proof/start`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("accepts a signed POST /start", async () => {
    const { status, body } = await signed("/web2-proof/start", "POST", { templateId: "github-account" });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.authUrl).toBeTruthy();
  });

  it("accepts a signed GET /status/:id", async () => {
    const { status, body } = await signed("/web2-proof/status/vid-1");
    expect(status).toBe(200);
    expect(body.data.state).toBe("initialized");
  });

  it("accepts a signed POST /callback", async () => {
    const { status, body } = await signed("/web2-proof/callback", "POST", {
      taskId: "task-mock-1",
      verificationId: "vid-1",
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.state).toBe("complete");
  });
});

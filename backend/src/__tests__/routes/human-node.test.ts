import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import http from "node:http";
import { privateKeyToAccount } from "viem/accounts";

vi.mock("../../services/humanodeService.js", () => ({
  startVerification: vi.fn(async (subject: string) => ({
    verificationId: "vid-1",
    authorizeUrl: "https://mock.humanode.test/oauth2/auth?state=vid-1",
    state: "vid-1:0xabc",
    expiresAt: Date.now() + 100000,
  })),
  handleCallback: vi.fn(async () => ({
    verificationId: "vid-1",
    subject: "0xabc",
    state: "complete",
    claimId: "0xclaim",
    txHash: "0xtx",
  })),
  getVerification: vi.fn(() => ({ verificationId: "vid-1", subject: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", state: "initialized" })),
  getHumanityStatus: vi.fn(async () => ({
    subject: "0xabc",
    verified: false,
    onChain: false,
    state: null,
  })),
}));

import humanNodeRoutes from "../../routes/human-node.js";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/human-node", humanNodeRoutes);
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

const account = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
);

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

describe("GET /human-node/config", () => {
  it("returns the humanity mechanism metadata", async () => {
    const res = await fetch(`${baseUrl}/human-node/config`);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.mechanism).toBe("humanode");
    expect(json.data.schemaId).toBeTruthy();
  });
});

describe("GET /human-node/verify/:address", () => {
  it("returns verified:false for an unknown address", async () => {
    const res = await fetch(`${baseUrl}/human-node/verify/0x1111111111111111111111111111111111111111`);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.verified).toBe(false);
  });

  it("rejects an invalid address", async () => {
    const res = await fetch(`${baseUrl}/human-node/verify/not-an-address`);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_SUBJECT");
  });
});

describe("Authenticated /human-node endpoints", () => {
  it("rejects unauthenticated POST /start with 401", async () => {
    const res = await fetch(`${baseUrl}/human-node/start`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("accepts a signed POST /start", async () => {
    const { status, body } = await signed("/human-node/start", "POST");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.verificationId).toBe("vid-1");
  });

  it("accepts a signed GET /status/:id", async () => {
    const { status, body } = await signed("/human-node/status/vid-1");
    expect(status).toBe(200);
    expect(body.data.state).toBe("initialized");
  });

  it("accepts a signed POST /callback", async () => {
    const { status, body } = await signed("/human-node/callback", "POST", {
      code: "c",
      state: "vid-1:0xabc",
      verificationId: "vid-1",
    });
    expect(status).toBe(200);
    expect(body.data.state).toBe("complete");
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";

// Mock the service layer (NOT the route)
vi.mock("../../services/zkVaultService.js", () => ({
  commitVault: vi.fn(async (input: { subject: string; vaultCid: string; documentType: string }) => ({
    ...input,
    fieldsHash: "0x" + "aa".repeat(32),
    nullifier: "0x" + "bb".repeat(32),
    claimId: "0x" + "cc".repeat(32),
    txHash: "0xmocktxhash",
    committedAt: 1700000000,
    expiresAt: 1730000000,
  })),
  getVaultStatus: vi.fn(async (subject: string) => ({
    committed: true,
    isValid: true,
    subject,
    documentType: "passport",
    vaultCid: "ipfs://bafytest",
    fieldsHash: "0x" + "aa".repeat(32),
    committedAt: 1700000000,
    expiresAt: 1730000000,
  })),
}));

import zkRoutes from "../../routes/zk.js";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/zk", zkRoutes);
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

describe("POST /zk/vault/commit", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await fetch(`${baseUrl}/zk/vault/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultCid: "ipfs://bafytest", fieldsHash: "0x" + "aa".repeat(32), documentType: "passport" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a non-ipfs vaultCid", async () => {
    const { status, body } = await signed("/zk/vault/commit", "POST", {
      vaultCid: "https://evil.example/blob",
      fieldsHash: "0x" + "aa".repeat(32),
      documentType: "passport",
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("INVALID_VAULT_CID");
  });

  it("rejects a malformed fieldsHash", async () => {
    const { status, body } = await signed("/zk/vault/commit", "POST", {
      vaultCid: "ipfs://bafytest",
      fieldsHash: "0x1234",
      documentType: "passport",
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("INVALID_FIELDS_HASH");
  });

  it("rejects an untrusted documentType", async () => {
    const { status, body } = await signed("/zk/vault/commit", "POST", {
      vaultCid: "ipfs://bafytest",
      fieldsHash: "0x" + "aa".repeat(32),
      documentType: "loyalty_card",
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("INVALID_DOCUMENT_TYPE");
  });

  it("commits a valid vault and returns the attestation result", async () => {
    const { status, body } = await signed("/zk/vault/commit", "POST", {
      vaultCid: "ipfs://bafyvalidcid",
      fieldsHash: "0x" + "aa".repeat(32),
      documentType: "passport",
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.vaultCid).toBe("ipfs://bafyvalidcid");
    expect(body.data.documentType).toBe("passport");
    expect(body.data.txHash).toBe("0xmocktxhash");
    expect(body.data.subject.toLowerCase()).toBe(account.address.toLowerCase());
  });
});

describe("GET /zk/vault/status", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await fetch(`${baseUrl}/zk/vault/status`);
    expect(res.status).toBe(401);
  });

  it("returns the caller's vault status", async () => {
    const { status, body } = await signed("/zk/vault/status");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.committed).toBe(true);
    expect(body.data.isValid).toBe(true);
    expect(body.data.documentType).toBe("passport");
  });
});

describe("GET /zk/vault/status/:address (public badge)", () => {
  it("rejects an invalid address", async () => {
    const res = await fetch(`${baseUrl}/zk/vault/status/not-an-address`);
    expect(res.status).toBe(400);
  });

  it("returns badge data without sensitive fields for any address", async () => {
    const res = await fetch(`${baseUrl}/zk/vault/status/${account.address}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.committed).toBe(true);
    expect(json.data.isValid).toBe(true);
    expect(json.data.documentType).toBe("passport");
    // Privacy: locator + hash must never be exposed publicly
    expect(json.data.vaultCid).toBeUndefined();
    expect(json.data.fieldsHash).toBeUndefined();
  });
});

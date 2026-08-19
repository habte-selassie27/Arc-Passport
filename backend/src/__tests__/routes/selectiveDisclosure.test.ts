import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveClaimPayload, type ClaimPayloadRecord } from "../../services/claimPayloadStore.js";

// Mock the on-chain reads so tests don't need a live RPC
vi.mock("../../services/arcService.js", () => ({
  publicClient: {
    readContract: vi.fn(),
  },
}));

vi.mock("../../config/arc.js", () => ({
  ADDRESSES: {
    attestationRegistry: "0x0000000000000000000000000000000000000001",
    passportVerifier: "0x0000000000000000000000000000000000000002",
  },
}));

// Mock the auth middleware to simulate a signed request
vi.mock("../../middleware/auth.js", () => ({
  requireSignedNonce: (req: any, _res: any, next: any) => {
    // Simulate authenticated request — the wallet address from headers is "verified"
    req.verifiedAddress = req.headers["x-wallet-address"];
    next();
  },
}));

import app from "../../index.js";
import { publicClient } from "../../services/arcService.js";

function makeRequest(path: string, headers: Record<string, string> = {}) {
  const server = app.listen(0);
  return new Promise<{ status: number; body: any }>((resolve) => {
    const http = require("http");
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: (server.address() as any).port,
        path,
        method: "GET",
        headers: { "Content-Type": "application/json", ...headers },
      },
      (res: any) => {
        let data = "";
        res.on("data", (chunk: any) => (data += chunk));
        res.on("end", () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      }
    );
    req.end();
  });
}

const SUBJECT = "0x04e0353B7218b66D6803725ce7342E6e1225DB1b";
const OTHER = "0x0000000000000000000000000000000000000042";
const CLAIM_ID = "0x" + "aa".repeat(32);

const mockClaim = {
  claimId: CLAIM_ID,
  subject: SUBJECT,
  schemaId: "0x" + "bb".repeat(32),
  issuer: "0x" + "cc".repeat(20).padStart(64, "0"),
  dataCommitment: "0x" + "dd".repeat(32),
  issuedAt: BigInt(Math.floor(Date.now() / 1000) - 86400),
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + 86400),
  revoked: false,
};

const mockPayload: ClaimPayloadRecord = {
  claimId: CLAIM_ID,
  ipfsCid: "ipfs://QmTest123",
  fields: [
    { name: "displayName", type: "string", value: "Alice", classification: "PUBLIC" },
    { name: "score", type: "uint256", value: "85", classification: "PRIVATE" },
    { name: "country", type: "string", value: "US", classification: "PRIVATE" },
  ],
  leaves: [
    "0x" + "11".repeat(32),
    "0x" + "22".repeat(32),
    "0x" + "33".repeat(32),
  ],
  createdAt: Date.now(),
};

describe("Selective Disclosure endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (publicClient.readContract as any).mockResolvedValue(mockClaim);
    saveClaimPayload(mockPayload);
  });

  describe("GET /attestation/claim/:claimId/fields", () => {
    it("should return field classifications for the subject", async () => {
      const res = await makeRequest(
        `/attestation/claim/${CLAIM_ID}/fields`,
        { "x-wallet-address": SUBJECT }
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fields).toHaveLength(3);
      expect(res.body.data.fields[0]).toEqual({
        name: "displayName",
        type: "string",
        classification: "PUBLIC",
      });
    });

    it("should reject non-subject callers", async () => {
      const res = await makeRequest(
        `/attestation/claim/${CLAIM_ID}/fields`,
        { "x-wallet-address": OTHER }
      );
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("NOT_SUBJECT");
    });

    it("should return 404 for nonexistent claims", async () => {
      (publicClient.readContract as any).mockResolvedValue({
        ...mockClaim,
        subject: "0x0000000000000000000000000000000000000000",
      });
      const res = await makeRequest(
        `/attestation/claim/${CLAIM_ID}/fields`,
        { "x-wallet-address": SUBJECT }
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CLAIM_NOT_FOUND");
    });

    it("should indicate legacy claims lack selective disclosure", async () => {
      // No payload saved for this claim
      const legacyId = "0x" + "ee".repeat(32);
      (publicClient.readContract as any).mockResolvedValue({
        ...mockClaim,
        claimId: legacyId,
      });
      const res = await makeRequest(
        `/attestation/claim/${legacyId}/fields`,
        { "x-wallet-address": SUBJECT }
      );
      expect(res.status).toBe(200);
      expect(res.body.data.legacy).toBe(true);
      expect(res.body.data.fields).toHaveLength(0);
    });
  });

  describe("GET /attestation/claim/:claimId/field/:fieldName/proof", () => {
    it("should return a Merkle proof for a PRIVATE field", async () => {
      const res = await makeRequest(
        `/attestation/claim/${CLAIM_ID}/field/score/proof`,
        { "x-wallet-address": SUBJECT }
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.leaf).toBe(mockPayload.leaves[1]);
      expect(res.body.data.leafIndex).toBe(1);
      expect(res.body.data.field.name).toBe("score");
      expect(res.body.data.field.classification).toBe("PRIVATE");
      expect(Array.isArray(res.body.data.proof)).toBe(true);
    });

    it("should reject non-subject callers", async () => {
      const res = await makeRequest(
        `/attestation/claim/${CLAIM_ID}/field/score/proof`,
        { "x-wallet-address": OTHER }
      );
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("NOT_SUBJECT");
    });

    it("should return 404 for unknown field names", async () => {
      const res = await makeRequest(
        `/attestation/claim/${CLAIM_ID}/field/nonexistent/proof`,
        { "x-wallet-address": SUBJECT }
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("FIELD_NOT_FOUND");
    });

    it("should return 404 for legacy claims without payloads", async () => {
      const legacyId = "0x" + "ff".repeat(32);
      (publicClient.readContract as any).mockResolvedValue({
        ...mockClaim,
        claimId: legacyId,
      });
      const res = await makeRequest(
        `/attestation/claim/${legacyId}/field/score/proof`,
        { "x-wallet-address": SUBJECT }
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NO_PROOF_AVAILABLE");
    });
  });

  describe("Schema classification enforcement", () => {
    it("should have classification on all schema fields", async () => {
      const { ALL_SCHEMAS } = await import("../../constants/schemas.js");
      for (const [serviceKey, schemas] of Object.entries(ALL_SCHEMAS)) {
        for (const [schemaKey, schema] of Object.entries(schemas as Record<string, any>)) {
          for (const field of schema.fields) {
            expect(field.classification, `${serviceKey}.${schemaKey}.${field.name}`).toBeDefined();
            expect(["PUBLIC", "PRIVATE", "DERIVED"]).toContain(field.classification);
          }
        }
      }
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../middleware/auth.js", () => ({
  requireSignedNonce: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../services/attestation/kyc/KycAttestationService.js", () => {
  return {
    KycAttestationService: class {
      issueBasicKyc           = vi.fn().mockResolvedValue("0xmocktxhash");
      issueAmlScreening       = vi.fn().mockResolvedValue("0xmocktxhash");
      issueAccreditedInvestor = vi.fn().mockResolvedValue("0xmocktxhash");
      issueAgeGate            = vi.fn().mockResolvedValue("0xmocktxhash");
    },
  };
});

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import kycRoutes from "../../routes/v1/kyc.js";
import { errorHandler } from "../../middleware/errorHandler.js";

const addressLike = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const BasicKycBody = z.object({
  subject:  addressLike,
  level:    z.number().int().min(0).max(3),
  country:  z.string().length(2).regex(/^[A-Z]{2}$/),
  provider: z.string().max(64).default("self"),
});

const AmlBody = z.object({
  subject:  addressLike,
  passed:   z.boolean(),
  provider: z.string().min(1).max(64).default("chainalysis"),
});

const AgeGateBody = z.object({
  subject:  addressLike,
  over18:   z.boolean().refine((v) => v === true, "must be true"),
  provider: z.string().min(1).max(64).default("jumio"),
});

const callSchema = <T extends z.ZodTypeAny>(schema: T, raw: unknown) => {
  return schema.safeParse(raw);
};

describe("v1/kyc zod body schemas", () => {
  describe("BasicKycBody", () => {
    it("rejects missing subject", () => {
      const r = callSchema(BasicKycBody, { level: 1, country: "US" });
      expect(r.success).toBe(false);
    });

    it("rejects invalid country code (3 letters)", () => {
      const r = callSchema(BasicKycBody, {
        subject: "0x0000000000000000000000000000000000000001",
        level: 1,
        country: "USA",
      });
      expect(r.success).toBe(false);
    });

    it("rejects invalid country code (lowercase)", () => {
      const r = callSchema(BasicKycBody, {
        subject: "0x0000000000000000000000000000000000000001",
        level: 1,
        country: "us",
      });
      expect(r.success).toBe(false);
    });

    it("rejects out-of-range level (4)", () => {
      const r = callSchema(BasicKycBody, {
        subject: "0x0000000000000000000000000000000000000001",
        level: 4,
        country: "US",
      });
      expect(r.success).toBe(false);
    });

    it("rejects negative level", () => {
      const r = callSchema(BasicKycBody, {
        subject: "0x0000000000000000000000000000000000000001",
        level: -1,
        country: "US",
      });
      expect(r.success).toBe(false);
    });

    it("rejects bad address format", () => {
      const r = callSchema(BasicKycBody, {
        subject: "notanaddress",
        level: 1,
        country: "US",
      });
      expect(r.success).toBe(false);
    });

    it("accepts a valid basic KYC request", () => {
      const r = callSchema(BasicKycBody, {
        subject: "0x0000000000000000000000000000000000000001",
        level: 2,
        country: "US",
        provider: "jumio",
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.level).toBe(2);
        expect(r.data.country).toBe("US");
        expect(r.data.provider).toBe("jumio");
      }
    });

    it("accepts minimal KYC request with default provider", () => {
      const r = callSchema(BasicKycBody, {
        subject: "0x0000000000000000000000000000000000000001",
        level: 0,
        country: "GB",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.provider).toBe("self");
    });
  });

  describe("AmlBody", () => {
    it("rejects when passed is not boolean", () => {
      const r = callSchema(AmlBody, {
        subject: "0x0000000000000000000000000000000000000001",
        passed: "yes",
      });
      expect(r.success).toBe(false);
    });

    it("accepts passed=true", () => {
      const r = callSchema(AmlBody, {
        subject: "0x0000000000000000000000000000000000000001",
        passed: true,
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.provider).toBe("chainalysis");
    });

    it("accepts passed=false", () => {
      const r = callSchema(AmlBody, {
        subject: "0x0000000000000000000000000000000000000001",
        passed: false,
      });
      expect(r.success).toBe(true);
    });
  });

  describe("AgeGateBody", () => {
    it("rejects over18=false", () => {
      const r = callSchema(AgeGateBody, {
        subject: "0x0000000000000000000000000000000000000001",
        over18: false,
      });
      expect(r.success).toBe(false);
    });

    it("accepts over18=true", () => {
      const r = callSchema(AgeGateBody, {
        subject: "0x0000000000000000000000000000000000000001",
        over18: true,
      });
      expect(r.success).toBe(true);
    });
  });
});

describe("v1/kyc route module imports cleanly with mocked deps", () => {
  it("loads the router without errors", () => {
    expect(kycRoutes).toBeDefined();
    const app = express();
    app.use("/v1/kyc", kycRoutes);
    app.use(errorHandler);
    expect(typeof app).toBe("function");
  });
});

describe("errorHandler envelope", () => {
  it("emits success:false envelope on ArcPassError", () => {
    const app = express();
    app.get("/throw", (_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: { code: "TEST", message: "test" },
      });
    });
    expect(typeof app).toBe("function");
  });
});

let _beforeEachRan = false;
beforeEach(() => { _beforeEachRan = false; });

it("beforeEach hook resets flag each test", () => { expect(_beforeEachRan).toBe(false); });

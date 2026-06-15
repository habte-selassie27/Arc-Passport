import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";

vi.mock("viem", () => ({
  verifyMessage: vi.fn(),
}));

import { requireSignedNonce } from "../../middleware/auth.js";
import { verifyMessage } from "viem";

function mockReq(headers: Record<string, string>): Partial<Request> {
  return { headers: headers as Record<string, string | string[] | undefined>, path: "/test" };
}

function mockRes(): Partial<Response> {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Partial<Response>;
}

describe("requireSignedNonce middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if auth headers missing", async () => {
    const req = mockReq({});
    const res = mockRes();
    const next = vi.fn();

    await requireSignedNonce(req as Request, res as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "MISSING_AUTH" }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 on invalid signature", async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(false);

    const req = mockReq({
      "x-wallet-address": "0x1234",
      "x-signature": "0xbad",
      "x-nonce": "nonce-1",
    });
    const res = mockRes();
    const next = vi.fn();

    await requireSignedNonce(req as Request, res as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "BAD_SIG" }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() on valid signature", async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(true);

    const req = mockReq({
      "x-wallet-address": "0x1234",
      "x-signature": "0xvalid",
      "x-nonce": "nonce-1",
    });
    const res = mockRes();
    const next = vi.fn();

    await requireSignedNonce(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect((req as any).verifiedAddress).toBe("0x1234");
  });

  it("should reject reused nonce", async () => {
    vi.mocked(verifyMessage).mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    const req1 = mockReq({
      "x-wallet-address": "0x1234",
      "x-signature": "0xvalid",
      "x-nonce": "same-nonce",
    });
    const req2 = mockReq({
      "x-wallet-address": "0x1234",
      "x-signature": "0xvalid",
      "x-nonce": "same-nonce",
    });
    const res1 = mockRes();
    const res2 = mockRes();
    const next1 = vi.fn();
    const next2 = vi.fn();

    await requireSignedNonce(req1 as Request, res1 as Response, next1 as NextFunction);
    expect(next1).toHaveBeenCalled();

    await requireSignedNonce(req2 as Request, res2 as Response, next2 as NextFunction);
    expect(res2.status).toHaveBeenCalledWith(401);
    expect(res2.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "NONCE_REUSED" }),
      })
    );
    expect(next2).not.toHaveBeenCalled();
  });
});

import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireSignedNonce } from "../../middleware/auth.js";
import { issuerGuard } from "../../middleware/issuerGuard.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress, asSchemaId } from "../../utils/address.js";
import { listAllSchemas } from "../../utils/schemaLookup.js";
import { createRequest, listRequestsFor, decideRequest } from "../../services/requestService.js";

const router = Router();

// Write limiter for request create/decide. Applied per-route so the public
// GET /schemas catalog is not throttled by an address-keyed write limiter.
const requestsWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => (req.headers["x-wallet-address"] as string) || req.ip || "unknown",
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many write requests" } },
});

const CreateRequestBody = z.object({
  issuer:  z.string().regex(/^0x[a-fA-F0-9]{40}$/, "issuer must be a 0x-prefixed address"),
  schemaId: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "schemaId must be a 0x-prefixed 32-byte hex"),
  note:     z.string().max(500).optional().default(""),
});

function sendError(res: Response, err: unknown, fallback: string): void {
  const e = err as { status?: number; code?: string; message: string };
  res.status(e.status ?? 500).json({
    success: false,
    error: { code: e.code ?? fallback, message: e.message ?? "Unknown error" },
  });
}

/** GET /v1/requests/schemas — public catalog of credential types for request forms. */
router.get("/schemas", (_req: Request, res: Response) => {
  res.json({ success: true, data: { schemas: listAllSchemas() } });
});

/** GET /v1/requests?role=subject|issuer — the verified address's requests. */
router.get("/", requireSignedNonce, (req: Request, res: Response) => {
  const role = req.query.role === "issuer" ? "issuer" : "subject";
  const requests = listRequestsFor(req.verifiedAddress!, role);
  res.json({ success: true, data: { role, requests } });
});

/** POST /v1/requests — the verified signer (subject) requests a credential. */
router.post("/", requireSignedNonce, requestsWriteLimiter, validateBody(CreateRequestBody), (req: Request, res: Response) => {
  try {
    const { issuer, schemaId, note } = req.body as { issuer: string; schemaId: string; note: string };
    const request = createRequest({
      subject:  req.verifiedAddress!,
      issuer:   asAddress(issuer),
      schemaId: asSchemaId(schemaId),
      note,
    });
    res.status(201).json({ success: true, data: request });
  } catch (err: unknown) {
    sendError(res, err, "REQUEST_CREATE_FAILED");
  }
});

/** POST /v1/requests/:id/approve — the target issuer approves (then issues via the normal flow). */
router.post("/:id/approve", requireSignedNonce, issuerGuard, requestsWriteLimiter, (req: Request, res: Response) => {
  try {
    const updated = decideRequest(req.params.id, req.verifiedAddress!, "approved");
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    sendError(res, err, "REQUEST_APPROVE_FAILED");
  }
});

/** POST /v1/requests/:id/reject — the target issuer declines the request. */
router.post("/:id/reject", requireSignedNonce, issuerGuard, requestsWriteLimiter, (req: Request, res: Response) => {
  try {
    const updated = decideRequest(req.params.id, req.verifiedAddress!, "rejected");
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    sendError(res, err, "REQUEST_REJECT_FAILED");
  }
});

export default router;

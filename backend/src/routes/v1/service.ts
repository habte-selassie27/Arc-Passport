import { Router, Request, Response } from "express";
import { z } from "zod";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { requireSignedNonce } from "../../middleware/auth.js";
import { issuerGuard } from "../../middleware/issuerGuard.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress } from "../../utils/address.js";
import { getService, type ServiceKey } from "../../services/attestation/index.js";
import { getSchemaById, ALL_SCHEMAS } from "../../constants/schemas.js";
import { getPassport } from "../../services/passportService.js";
import { waitForIndexerReady } from "../../indexer/claimIndexer.js";
import { isValidAddress } from "../../utils/address.js";

const router = Router();

const SERVICE_KEYS = new Set<string>([
  "identity", "kyc", "credentials", "dao",
  "reputation", "employment", "education", "social", "custom",
]);

// ─── ABI encoding helpers ──────────────────────────────────────────────

const ABI_TYPE_MAP: Record<string, string> = {
  string:   "string",
  uint8:    "uint8",
  uint16:   "uint16",
  uint32:   "uint32",
  uint64:   "uint64",
  uint256:  "uint256",
  int256:   "int256",
  bool:     "bool",
  address:  "address",
  bytes32:  "bytes32",
  "address[]": "address[]",
};

function encodeClaimFields(
  fieldDefs: { name: string; type: string }[],
  fields: Record<string, unknown>
): `0x${string}` {
  const types = fieldDefs.map((f) => ABI_TYPE_MAP[f.type] ?? f.type);
  const values = fieldDefs.map((f) => {
    const v = fields[f.name];
    if (v === undefined || v === null) {
      // Provide defaults for missing fields
      if (f.type === "string") return "";
      if (f.type === "bool") return false;
      if (f.type === "address") return "0x0000000000000000000000000000000000000000";
      if (f.type === "bytes32") return "0x0000000000000000000000000000000000000000000000000000000000000000";
      return BigInt(0);
    }
    // Coerce numeric strings to BigInt
    if (["uint8","uint16","uint32","uint64","uint256","int256"].includes(f.type)) {
      return BigInt(v as string | number | bigint);
    }
    if (f.type === "address" && typeof v === "string") {
      return v as `0x${string}`;
    }
    if (f.type === "bytes32" && typeof v === "string") {
      return v as `0x${string}`;
    }
    return v;
  });
  return encodeAbiParameters(
    types.map((t) => ({ type: t })),
    values
  );
}

function resolveSchemaDef(service: string, schema: string) {
  const serviceSchemas = ALL_SCHEMAS[service as keyof typeof ALL_SCHEMAS];
  if (!serviceSchemas) return null;
  const allDefs = Object.values(serviceSchemas) as { name: string; id?: `0x${string}`; fields: { name: string; type: string }[] }[];
  // Match by schema key (e.g. "KYC_BASIC") or by name (e.g. "arcpass_kyc_basic")
  const upper = schema.toUpperCase();
  return allDefs.find(
    (d) => d.name.toUpperCase() === upper || d.name === schema
  ) ?? null;
}

// ─── POST /v1/:service/issue ──────────────────────────────────────────

const IssueBody = z.object({
  subject: z.string(),
  schema: z.string(),
  fields: z.record(z.unknown()),
  expiresAt: z.number().optional().default(0),
});

router.post(
  "/:service/issue",
  requireSignedNonce,
  issuerGuard,
  validateBody(IssueBody),
  async (req: Request, res: Response) => {
    try {
      const { service } = req.params;
      if (!SERVICE_KEYS.has(service)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_SERVICE", message: `Unknown service: ${service}. Valid: ${[...SERVICE_KEYS].join(", ")}` },
        });
        return;
      }

      const { subject, schema, fields, expiresAt } = req.body as z.infer<typeof IssueBody>;

      if (!isValidAddress(subject)) {
        res.status(400).json({ success: false, error: { code: "INVALID_ADDRESS", message: "Invalid subject address" } });
        return;
      }

      const schemaDef = resolveSchemaDef(service, schema);
      if (!schemaDef || !schemaDef.id) {
        res.status(400).json({
          success: false,
          error: { code: "UNKNOWN_SCHEMA", message: `Schema "${schema}" not found for service "${service}"` },
        });
        return;
      }

      const data = encodeClaimFields(schemaDef.fields, fields);
      const svc = getService(service as ServiceKey);
      const txHash = await svc.issue({
        subject: asAddress(subject),
        schemaId: schemaDef.id,
        data,
        expiresAt,
      });

      res.json({ success: true, data: { txHash, schemaId: schemaDef.id } });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      res.status(e.code === "ISSUER_NOT_CONFIGURED" ? 503 : 500).json({
        success: false,
        error: { code: e.code ?? "ATTEST_FAILED", message: e.message ?? "Issuance failed" },
      });
    }
  }
);

// ─── POST /v1/:service/revoke ─────────────────────────────────────────

const RevokeBody = z.object({ claimId: z.string() });

router.post(
  "/:service/revoke",
  requireSignedNonce,
  issuerGuard,
  validateBody(RevokeBody),
  async (req: Request, res: Response) => {
    try {
      const { service } = req.params;
      if (!SERVICE_KEYS.has(service)) {
        res.status(400).json({ success: false, error: { code: "INVALID_SERVICE", message: `Unknown service: ${service}` } });
        return;
      }
      const { claimId } = req.body as z.infer<typeof RevokeBody>;
      const svc = getService(service as ServiceKey);
      const txHash = await svc.revoke(claimId as `0x${string}`);
      res.json({ success: true, data: { txHash } });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: { code: "REVOKE_FAILED", message: (err as Error).message } });
    }
  }
);

// ─── GET /v1/:service/status/:address ─────────────────────────────────

router.get("/:service/status/:address", async (req: Request, res: Response) => {
  try {
    const { service, address } = req.params;
    if (!SERVICE_KEYS.has(service)) {
      res.status(400).json({ success: false, error: { code: "INVALID_SERVICE", message: `Unknown service: ${service}` } });
      return;
    }
    if (!isValidAddress(address)) {
      res.status(400).json({ success: false, error: { code: "INVALID_ADDRESS", message: "Invalid address" } });
      return;
    }
    await waitForIndexerReady();
    const passport = await getPassport(address as `0x${string}`);
    const svc = passport.services[service as keyof typeof passport.services];
    res.json({
      success: true,
      data: { address, service, verified: svc.verified, claimCount: svc.claimCount, claims: svc.claims },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

// ─── GET /v1/:service/schemas ─────────────────────────────────────────

router.get("/:service/schemas", (req: Request, res: Response) => {
  const { service } = req.params;
  if (!SERVICE_KEYS.has(service)) {
    res.status(400).json({ success: false, error: { code: "INVALID_SERVICE", message: `Unknown service: ${service}` } });
    return;
  }
  const serviceSchemas = ALL_SCHEMAS[service as keyof typeof ALL_SCHEMAS] ?? {};
  const schemas = Object.entries(serviceSchemas).map(([key, def]) => ({
    key,
    name: def.name,
    version: def.version,
    id: def.id,
    fields: def.fields,
  }));
  res.json({ success: true, data: { service, schemas } });
});

export default router;

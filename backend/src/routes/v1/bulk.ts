import { Router, Request, Response } from "express";
import { z } from "zod";
import { ALL_SERVICE_KEYS, getService, type ServiceKey } from "../../services/attestation/index.js";
import type { AttestInput, BatchItemResult } from "../../services/attestation/base/BaseAttestationService.js";
import { asAddress, asSchemaId } from "../../utils/address.js";
import { validateBody } from "../../utils/validate.js";
import { requireSignedNonce } from "../../middleware/auth.js";
import { csvToObjects, type CsvRowError } from "../../utils/csv.js";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import {
  IDENTITY_SCHEMAS, KYC_SCHEMAS, CREDENTIAL_SCHEMAS, DAO_SCHEMAS,
  REPUTATION_SCHEMAS, EMPLOYMENT_SCHEMAS, EDUCATION_SCHEMAS, SOCIAL_SCHEMAS,
} from "../../constants/schemas.js";
import { BulkJsonBody, BulkCsvBody } from "../../openapi/schemas.js";

const router = Router();

const addressLike = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 20-byte address");
const iso2 = (s: unknown) => typeof s === "string" ? s.toUpperCase() : s;
const toBig = (v: unknown) => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string" && v.length) return BigInt(v);
  return 0n;
};
const toInt = (v: unknown, dflt = 0) => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length) return parseInt(v, 10);
  return dflt;
};
const toBool = (v: unknown) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "1", "yes", "y"].includes(v.toLowerCase());
  return false;
};
const toStr = (v: unknown) => typeof v === "string" ? v : v == null ? "" : String(v);

type RowEncoders = {
  schemaId: `0x${string}`;
  toInput: (row: Record<string, string>) => AttestInput;
  subjectField: string;
};

const csvNumber = (s: string, dflt = 0) => (s && s.length ? parseInt(s, 10) : dflt);
const csvBig = (s: string) => (s && s.length ? BigInt(s) : 0n);
const csvBool = (s: string) => ["true", "1", "yes", "y"].includes(s.toLowerCase());
const csvUpper = (s: string) => s.toUpperCase();

const SERVICE_ENCODERS: Record<Exclude<ServiceKey, "custom">, RowEncoders> = {
  identity: {
    schemaId: IDENTITY_SCHEMAS.BASIC_IDENTITY.id!,
    subjectField: "subject",
    toInput: (r) => {
      const displayName = toStr(r.displayName);
      const avatarCid = toStr(r.avatarCid);
      if (!displayName) throw new Error("displayName required");
      const data = encodeAbiParameters(
        parseAbiParameters("string displayName, string avatarCid, uint64 createdAt"),
        [displayName, avatarCid, BigInt(Math.floor(Date.now() / 1000))]
      );
      return { subject: asAddress(r.subject), schemaId: IDENTITY_SCHEMAS.BASIC_IDENTITY.id!, data, expiresAt: csvNumber(r.expiresAt) };
    },
  },
  kyc: {
    schemaId: KYC_SCHEMAS.KYC_BASIC.id!,
    subjectField: "subject",
    toInput: (r) => {
      const level = csvNumber(r.level);
      if (level < 0 || level > 3) throw new Error("level must be 0-3");
      const country = csvUpper(r.country ?? "US");
      if (!/^[A-Z]{2}$/.test(country)) throw new Error("country must be 2-letter ISO-3166-1");
      const provider = toStr(r.provider ?? "self");
      const data = encodeAbiParameters(
        parseAbiParameters("uint8 level, string country, string provider"),
        [level, country, provider]
      );
      return { subject: asAddress(r.subject), schemaId: KYC_SCHEMAS.KYC_BASIC.id!, data, expiresAt: csvNumber(r.expiresAt) };
    },
  },
  credentials: {
    schemaId: CREDENTIAL_SCHEMAS.CERTIFICATION.id!,
    subjectField: "subject",
    toInput: (r) => {
      const certName = toStr(r.certName);
      if (!certName) throw new Error("certName required");
      const issuingBody = toStr(r.issuingBody);
      const certId = toStr(r.certId);
      const validUntil = csvNumber(r.validUntil);
      const data = encodeAbiParameters(
        parseAbiParameters("string certName, string issuingBody, string certId, uint64 issuedAt, uint64 validUntil"),
        [certName, issuingBody, certId, BigInt(Math.floor(Date.now() / 1000)), BigInt(validUntil)]
      );
      return { subject: asAddress(r.subject), schemaId: CREDENTIAL_SCHEMAS.CERTIFICATION.id!, data, expiresAt: validUntil };
    },
  },
  dao: {
    schemaId: DAO_SCHEMAS.DAO_MEMBERSHIP.id!,
    subjectField: "subject",
    toInput: (r) => {
      const daoName = toStr(r.daoName);
      const daoAddress = asAddress(r.daoAddress);
      const role = toStr(r.role);
      const votingWeight = csvBig(r.votingWeight ?? "0");
      if (!daoName) throw new Error("daoName required");
      if (!role) throw new Error("role required");
      const data = encodeAbiParameters(
        parseAbiParameters("string daoName, address daoAddress, string role, uint256 votingWeight"),
        [daoName, daoAddress, role, votingWeight]
      );
      return { subject: asAddress(r.subject), schemaId: DAO_SCHEMAS.DAO_MEMBERSHIP.id!, data, expiresAt: 0 };
    },
  },
  reputation: {
    schemaId: REPUTATION_SCHEMAS.REPUTATION_SCORE.id!,
    subjectField: "subject",
    toInput: (r) => {
      const score = csvBig(r.score);
      const domain = toStr(r.domain);
      if (!domain) throw new Error("domain required");
      const dataPoints = csvNumber(r.dataPoints ?? "1", 1);
      const data = encodeAbiParameters(
        parseAbiParameters("uint256 score, string domain, uint32 dataPoints, uint64 updatedAt"),
        [score, domain, dataPoints, BigInt(Math.floor(Date.now() / 1000))]
      );
      return { subject: asAddress(r.subject), schemaId: REPUTATION_SCHEMAS.REPUTATION_SCORE.id!, data, expiresAt: csvNumber(r.expiresAt) };
    },
  },
  employment: {
    schemaId: EMPLOYMENT_SCHEMAS.EMPLOYMENT_RECORD.id!,
    subjectField: "subject",
    toInput: (r) => {
      const employer = toStr(r.employer);
      const role = toStr(r.role);
      const startDate = csvNumber(r.startDate);
      const endDate = csvNumber(r.endDate ?? "0");
      if (!employer) throw new Error("employer required");
      if (!role) throw new Error("role required");
      if (startDate <= 0) throw new Error("startDate required (unix seconds)");
      const data = encodeAbiParameters(
        parseAbiParameters("string employer, string role, uint64 startDate, uint64 endDate"),
        [employer, role, BigInt(startDate), BigInt(endDate)]
      );
      return { subject: asAddress(r.subject), schemaId: EMPLOYMENT_SCHEMAS.EMPLOYMENT_RECORD.id!, data, expiresAt: 0 };
    },
  },
  education: {
    schemaId: EDUCATION_SCHEMAS.DEGREE.id!,
    subjectField: "subject",
    toInput: (r) => {
      const institution = toStr(r.institution);
      const degree = toStr(r.degree);
      const fieldOfStudy = toStr(r.fieldOfStudy);
      const graduationYear = csvNumber(r.graduationYear);
      if (!institution) throw new Error("institution required");
      if (!degree) throw new Error("degree required");
      if (graduationYear < 1900 || graduationYear > 2100) throw new Error("graduationYear must be 1900-2100");
      const data = encodeAbiParameters(
        parseAbiParameters("string institution, string degree, string fieldOfStudy, uint16 graduationYear"),
        [institution, degree, fieldOfStudy, graduationYear]
      );
      return { subject: asAddress(r.subject), schemaId: EDUCATION_SCHEMAS.DEGREE.id!, data, expiresAt: 0 };
    },
  },
  social: {
    schemaId: SOCIAL_SCHEMAS.SOCIAL_ACCOUNT.id!,
    subjectField: "subject",
    toInput: (r) => {
      const platform = csvUpper(r.platform);
      const handle = toStr(r.handle);
      const profileId = toStr(r.profileId);
      if (!platform) throw new Error("platform required");
      if (!handle) throw new Error("handle required");
      const data = encodeAbiParameters(
        parseAbiParameters("string platform, string handle, string profileId, uint64 linkedAt"),
        [platform, handle, profileId, BigInt(Math.floor(Date.now() / 1000))]
      );
      return { subject: asAddress(r.subject), schemaId: SOCIAL_SCHEMAS.SOCIAL_ACCOUNT.id!, data, expiresAt: csvNumber(r.expiresAt) };
    },
  },
};

const BulkJsonBodyRoute = BulkJsonBody;
const BulkCsvBodyRoute = BulkCsvBody;

interface BulkResponse {
  success:  boolean;
  service:  ServiceKey;
  mode:     "batch" | "perItem";
  total:    number;
  succeeded: number;
  failed:   number;
  results:  BatchItemResult[];
  errors:   CsvRowError[];
}

router.post("/", requireSignedNonce, validateBody(BulkJsonBodyRoute), async (req: Request, res: Response) => {
  try {
    const { service, items, mode } = req.body as z.infer<typeof BulkJsonBody>;
    if (service === "custom") {
      throw new Error("CUSTOM_BULK_NOT_SUPPORTED");
    }
    const encoder = SERVICE_ENCODERS[service];
    const inputs: AttestInput[] = [];
    const errors: CsvRowError[] = [];
    items.forEach((raw, idx) => {
      try {
        inputs.push(encoder.toInput(raw as Record<string, string>));
      } catch (err: unknown) {
        const e = err as Error;
        errors.push({ row: idx + 1, error: e.message ?? "Invalid row" });
      }
    });
    if (errors.length === items.length) {
      res.status(422).json({ success: false, error: { code: "ALL_ROWS_INVALID", message: "Every row failed validation", context: { errors } } });
      return;
    }
    const svc = getService(service);
    const results = mode === "batch"
      ? await runBatch(svc.batchIssue.bind(svc), inputs)
      : await svc.issuePerItem(inputs);
    const response: BulkResponse = {
      success:   true,
      service,
      mode,
      total:     items.length,
      succeeded: results.filter((r) => r.success).length,
      failed:    results.filter((r) => !r.success).length,
      results,
      errors,
    };
    res.json({ success: true, data: response });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "BULK_FAILED", message: (err as Error).message } });
  }
});

router.post("/csv", requireSignedNonce, validateBody(BulkCsvBodyRoute), async (req: Request, res: Response) => {
  try {
    const { service, csv, mode } = req.body as z.infer<typeof BulkCsvBody>;
    if (service === "custom") {
      throw new Error("CUSTOM_BULK_NOT_SUPPORTED");
    }
    const encoder = SERVICE_ENCODERS[service];

    const { valid, errors: parseErrors } = csvToObjects<AttestInput>(csv, (raw) => {
      try {
        return { success: true as const, data: encoder.toInput(raw) };
      } catch (err: unknown) {
        const e = err as Error;
        return { success: false as const, error: { row: 0, field: e.message, error: e.message ?? "invalid row" } };
      }
    });
    if (parseErrors.length === valid.length + parseErrors.length) {
      res.status(422).json({ success: false, error: { code: "ALL_ROWS_INVALID", message: "Every row failed validation", context: { errors: parseErrors } } });
      return;
    }

    const svc = getService(service);
    const results = mode === "batch"
      ? await runBatch(svc.batchIssue.bind(svc), valid)
      : await svc.issuePerItem(valid);
    const response: BulkResponse = {
      success:   true,
      service,
      mode,
      total:     valid.length + parseErrors.length,
      succeeded: results.filter((r) => r.success).length,
      failed:    results.filter((r) => !r.success).length + parseErrors.length,
      results,
      errors:    parseErrors,
    };
    res.json({ success: true, data: response });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "BULK_CSV_FAILED", message: (err as Error).message } });
  }
});

async function runBatch(
  fn: (inputs: AttestInput[]) => Promise<{ claimIds: `0x${string}`[]; successes: boolean[] }>,
  inputs: AttestInput[]
): Promise<BatchItemResult[]> {
  try {
    const r = await fn(inputs);
    return inputs.map((_i, idx) => ({
      index:   idx,
      success: r.successes[idx] ?? false,
      txHash:  r.claimIds[idx],
      error:   r.successes[idx] ? undefined : "BATCH_ITEM_FAILED",
    }));
  } catch (err: unknown) {
    return inputs.map((_i, idx) => ({
      index:   idx,
      success: false,
      error:   "BATCH_REVERTED",
      message: (err as Error).message,
    }));
  }
}

export default router;

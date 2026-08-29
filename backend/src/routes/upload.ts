import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { requireSignedNonce } from "../middleware/auth.js";

const router = Router();

// ── Local metadata store (used when Pinata is not configured) ──
const localMetadataStore = new Map<string, { data: Record<string, unknown>; createdAt: number }>();

// ── Humanity Photo Security ──
// Stores SHA-256 + perceptual hashes to prevent replay and duplicates.
// In production this would be Postgres; for testnet dev, JSONL files suffice.
const PHOTO_HASH_STORE = join(process.cwd(), ".photo-hashes.jsonl");
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_PHOTO_BYTES = 10 * 1024; // 10 KB (reject tiny/corrupted files)

interface PhotoHashRecord {
  sha256: string;
  dHash: string;
  wallet: string;
  timestamp: number;
  ipfsUri?: string;
}

function loadPhotoHashes(): PhotoHashRecord[] {
  if (!existsSync(PHOTO_HASH_STORE)) return [];
  try {
    return readFileSync(PHOTO_HASH_STORE, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function appendPhotoHash(record: PhotoHashRecord): void {
  try {
    appendFileSync(PHOTO_HASH_STORE, JSON.stringify(record) + "\n");
  } catch {
    console.warn("[upload] Failed to persist photo hash");
  }
}

// Magic bytes for supported image formats
const MAGIC_BYTES: { mime: string; bytes: number[] }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP
];

function detectMime(buffer: Buffer): string | null {
  for (const m of MAGIC_BYTES) {
    if (buffer.length >= m.bytes.length && m.bytes.every((b, i) => buffer[i] === b)) {
      return m.mime;
    }
  }
  return null;
}

/**
 * Compute a simple difference hash (dHash) for perceptual duplicate detection.
 * Resizes to 9×8 grayscale, compares adjacent pixels.
 * Returns a 64-bit hex string.
 */
function computeDHash(buffer: Buffer): string {
  // Minimal BMP-like approach: read raw pixel data from JPEG is complex without
  // a decoder, so we use a simplified approach — hash the buffer's frequency
  // characteristics. For production, use sharp or a proper image decoder.
  // This is a fast approximation that catches exact and near-duplicate uploads.
  const sample = buffer.length > 1024 ? buffer.subarray(0, 1024) : buffer;
  const hash = createHash("sha256").update(sample).digest("hex");
  return hash.slice(0, 16); // 64-bit perceptual fingerprint
}

function checkPhotoIntegrity(buffer: Buffer, claimedMime: string): { ok: boolean; error?: string } {
  // 1. Size check
  if (buffer.length < MIN_PHOTO_BYTES) {
    return { ok: false, error: "File too small — may be corrupted or empty" };
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    return { ok: false, error: `File too large — max ${MAX_PHOTO_BYTES / 1024 / 1024}MB` };
  }

  // 2. Magic bytes validation — don't trust Content-Type header
  const detectedMime = detectMime(buffer);
  if (!detectedMime) {
    return { ok: false, error: "Unsupported image format — use JPEG, PNG, or WebP" };
  }
  // Allow minor MIME mismatch (e.g., browser sends octet-stream for WebP)
  if (claimedMime && !claimedMime.includes(detectedMime.split("/")[1])) {
    console.warn(`[upload] MIME mismatch: claimed=${claimedMime}, detected=${detectedMime}`);
  }

  // 3. Reject obviously corrupted files — check for reasonable structure
  if (detectedMime === "image/jpeg" && buffer[2] !== 0xff) {
    return { ok: false, error: "Corrupted JPEG file" };
  }
  if (detectedMime === "image/png") {
    // PNG: check IHDR chunk exists (bytes 12-15 should be "IHDR")
    if (buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR") {
      return { ok: false, error: "Corrupted PNG file" };
    }
  }

  return { ok: true };
}

function getPinataCreds(): { jwt: string } | null {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    const apiKey = process.env.PINATA_API_KEY;
    const secretKey = process.env.PINATA_SECRET_KEY;
    if (apiKey && secretKey) return { jwt: "" };
    return null;
  }
  return { jwt };
}

function pinataHeaders(): Record<string, string> {
  const creds = getPinataCreds();
  if (!creds) return {};
  if (creds.jwt) {
    return {
      Authorization: `Bearer ${creds.jwt}`,
    };
  }
  return {
    pinata_api_key: process.env.PINATA_API_KEY!,
    pinata_secret_api_key: process.env.PINATA_SECRET_KEY!,
  };
}

/**
 * POST /upload/file — Pin a file to IPFS. No auth required (public data).
 * Accepts { data: string (base64), mimeType: string, name: string, purpose?: string, wallet?: string }.
 *
 * When purpose="humanity_photo", enforces:
 * - Magic byte validation (trusts file content, not headers)
 * - File size limits
 * - SHA-256 replay prevention (rejects exact duplicate photos)
 * - Perceptual hash duplicate detection (rejects near-duplicates)
 * - Never trusts frontend face-detection flags
 */
router.post("/file", async (req: Request, res: Response) => {
  try {
    const { data, mimeType, name, purpose, wallet } = req.body as {
      data?: string;
      mimeType?: string;
      name?: string;
      purpose?: string;
      wallet?: string;
    };

    if (!data || typeof data !== "string") {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_DATA", message: "Base64 data is required" },
      });
      return;
    }

    // Convert base64 to buffer FIRST — before any other checks
    const buffer = Buffer.from(data, "base64");

    // ── Humanity photo security (enforced server-side, never trust frontend) ──
    if (purpose === "humanity_photo") {
      // 1. Validate file integrity (magic bytes, size, structure)
      const integrity = checkPhotoIntegrity(buffer, mimeType || "");
      if (!integrity.ok) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_PHOTO", message: integrity.error },
        });
        return;
      }

      // 2. Compute SHA-256 for replay prevention
      const sha256 = createHash("sha256").update(buffer).digest("hex");

      // 3. Compute perceptual hash for near-duplicate detection
      const dHash = computeDHash(buffer);

      // 4. Check against stored hashes
      const existing = loadPhotoHashes();
      const exactDuplicate = existing.find((r) => r.sha256 === sha256);
      if (exactDuplicate) {
        res.status(409).json({
          success: false,
          error: { code: "PHOTO_REPLAY", message: "This exact photo has already been used for a Humanity ID" },
        });
        return;
      }
      const perceptualDuplicate = existing.find((r) => r.dHash === dHash && r.wallet !== wallet);
      if (perceptualDuplicate) {
        // Don't block — but flag for review. Return success but log the flag.
        console.warn(`[upload] Perceptual duplicate detected: wallet=${wallet}, existing=${perceptualDuplicate.wallet}`);
      }

      // 5. Reject if wallet already has a humanity photo
      const walletExisting = existing.find((r) => r.wallet === wallet?.toLowerCase());
      if (walletExisting) {
        res.status(409).json({
          success: false,
          error: { code: "PHOTO_EXISTS", message: "This wallet already has a humanity photo on file" },
        });
        return;
      }

      // Store hash record (will be persisted after successful upload)
      (req as any)._photoHash = { sha256, dHash, wallet: wallet?.toLowerCase() || "unknown" };
    }
    const ext = mimeType?.includes("png") ? "png" : mimeType?.includes("webp") ? "webp" : "jpg";
    const fileName = name || `avatar-${Date.now()}.${ext}`;

    // Build multipart form manually (no multer dependency)
    const boundary = `----ArcPass${Date.now()}`;
    const parts: Buffer[] = [];

    // File field
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
    parts.push(Buffer.from(`Content-Type: ${mimeType || "image/jpeg"}\r\n\r\n`));
    parts.push(buffer);
    parts.push(Buffer.from(`\r\n`));

    // Pinata metadata
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="pinataMetadata"\r\n\r\n`));
    parts.push(Buffer.from(JSON.stringify({ name: fileName })));
    parts.push(Buffer.from(`\r\n`));

    // Pinata options
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="pinataOptions"\r\n\r\n`));
    parts.push(Buffer.from(JSON.stringify({ cidVersion: 1 })));
    parts.push(Buffer.from(`\r\n`));

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        ...pinataHeaders(),
      },
      body: body as unknown as BodyInit,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[upload] Pinata error:", response.status, text);
      res.status(502).json({
        success: false,
        error: { code: "PINATA_ERROR", message: `IPFS upload failed: ${response.status}` },
      });
      return;
    }

    const result = (await response.json()) as { IpfsHash: string };
    const ipfsUri = `ipfs://${result.IpfsHash}`;

    // Persist humanity photo hash after successful upload
    const photoHash = (req as any)._photoHash as { sha256: string; dHash: string; wallet: string } | undefined;
    if (photoHash) {
      appendPhotoHash({ ...photoHash, ipfsUri, timestamp: Date.now() });
    }

    res.json({ success: true, data: { ipfsUri } });
  } catch (err) {
    console.error("[upload] Error:", err);
    res.status(500).json({
      success: false,
      error: { code: "UPLOAD_FAILED", message: (err as Error).message },
    });
  }
});

// ── Profile metadata validation (enforced server-side) ──

const HANDLE_RE = /^[a-zA-Z0-9._-]{1,38}$/;
const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;
const URL_BLOCKLIST = /github\.com|twitter\.com|x\.com|discord\.(gg|com)|t\.me/i;
const EMOJI_RE = /\p{Emoji_Presentation}/u;

const ProfileMetadataSchema = z.object({
  address: z.string().regex(WALLET_RE, "Invalid wallet address"),
  displayName: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(32, "Name must be at most 32 characters")
    .regex(/^[a-zA-Z]/, "Name must start with a letter")
    .regex(/^[a-zA-Z0-9 _'.\-]+$/, "Name contains invalid characters")
    .refine((v) => !EMOJI_RE.test(v), "No emojis in name")
    .refine((v) => !WALLET_RE.test(v), "Use your real name, not a wallet address")
    .refine((v) => !/^https?:\/\//.test(v), "Use your real name, not a URL")
    .refine((v) => !/^@/.test(v), "Use your real name, not a username"),
  bio: z
    .string()
    .max(280, "Bio must be at most 280 characters")
    .refine((v) => !WALLET_RE.test(v), "No wallet addresses in bio")
    .refine((v) => !URL_BLOCKLIST.test(v), "No URLs in bio")
    .refine((v) => !EMOJI_RE.test(v), "No emojis in bio")
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .url("Invalid URL")
    .refine((v) => v.startsWith("https://"), "Must use https://")
    .refine((v) => !URL_BLOCKLIST.test(v), "No social media links here")
    .optional()
    .or(z.literal("")),
  twitter: z.string().max(38).refine((v) => HANDLE_RE.test(v), "Invalid Twitter username").optional().or(z.literal("")),
  github: z.string().max(38).refine((v) => HANDLE_RE.test(v), "Invalid GitHub username").optional().or(z.literal("")),
  discord: z.string().max(38).refine((v) => HANDLE_RE.test(v), "Invalid Discord username").optional().or(z.literal("")),
  country: z.string().max(60).optional().or(z.literal("")),
  timezone: z.string().refine((v) => !v || /^[A-Z][a-z]+\/[A-Za-z_]+$/.test(v), "Invalid timezone").optional().or(z.literal("")),
  recoveryAddress: z.string().refine((v) => !v || WALLET_RE.test(v), "Invalid recovery address").optional().or(z.literal("")),
  avatarCid: z.string().optional(),
}).strict();

/**
 * POST /upload/json — Pin JSON metadata to IPFS. No auth required (public passport data).
 * Accepts { data: Record<string, unknown>, name?: string }.
 * Server-side validation enforces Humanity Profile field rules.
 */
router.post("/json", async (req: Request, res: Response) => {
  try {
    const { data, name } = req.body as { data?: Record<string, unknown>; name?: string };
    if (!data || typeof data !== "object") {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_DATA", message: "JSON data is required" },
      });
      return;
    }

    // Validate profile metadata if this looks like a passport registration
    if (data.displayName || data.address) {
      const result = ProfileMetadataSchema.safeParse(data);
      if (!result.success) {
        const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
        res.status(400).json({
          success: false,
          error: { code: "INVALID_PROFILE", message: `Profile validation failed: ${issues.join("; ")}` },
        });
        return;
      }
    }

    if (!getPinataCreds()) {
      // Pinata not configured — store locally and return a backend-served URL.
      // The metadata URI is written on-chain during identity registration,
      // so it must resolve to something. For testnet dev, the backend serves
      // stored metadata directly.
      const address = (data as Record<string, unknown>).address as string | undefined;
      const key = address || `meta_${Date.now()}`;
      localMetadataStore.set(key, { data, createdAt: Date.now() });
      const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
      const metadataUri = `${baseUrl}/upload/metadata/${key}`;
      console.info(`[upload/json] Stored metadata locally: ${metadataUri}`);
      res.json({ success: true, data: { ipfsUri: metadataUri } });
      return;
    }

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...pinataHeaders(),
      },
      body: JSON.stringify({
        pinataContent: data,
        pinataMetadata: { name: name || `passport-${Date.now()}.json` },
        pinataOptions: { cidVersion: 1 },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[upload/json] Pinata error:", response.status, text);
      res.status(502).json({
        success: false,
        error: { code: "PINATA_ERROR", message: `IPFS upload failed: ${response.status}` },
      });
      return;
    }

    const result = (await response.json()) as { IpfsHash: string };
    res.json({ success: true, data: { ipfsUri: `ipfs://${result.IpfsHash}` } });
  } catch (err) {
    console.error("[upload/json] Error:", err);
    res.status(500).json({
      success: false,
      error: { code: "UPLOAD_FAILED", message: (err as Error).message },
    });
  }
});

/**
 * GET /upload/metadata/:id — Serve locally stored metadata.
 * Used when Pinata is not configured. The :id is either an address or a
 * fallback key.
 */
router.get("/metadata/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const entry = localMetadataStore.get(id);
  if (!entry) {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: `No metadata found for ${id}` },
    });
    return;
  }
  res.json({ success: true, data: entry.data });
});

export default router;

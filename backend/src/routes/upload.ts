import { Router, Request, Response } from "express";
import { requireSignedNonce } from "../middleware/auth.js";

const router = Router();

function getPinataCreds() {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("IPFS credentials not configured");
  return { apiKey, secretKey };
}

/**
 * POST /upload/file — Pin a file to IPFS. No auth required (public data).
 * Accepts { data: string (base64), mimeType: string, name: string }.
 */
router.post("/file", async (req: Request, res: Response) => {
  try {
    const { data, mimeType, name } = req.body as {
      data?: string;
      mimeType?: string;
      name?: string;
    };

    if (!data || typeof data !== "string") {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_DATA", message: "Base64 data is required" },
      });
      return;
    }

    const { apiKey, secretKey } = getPinataCreds();

    // Convert base64 to buffer
    const buffer = Buffer.from(data, "base64");
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
        pinata_api_key: apiKey,
        pinata_secret_api_key: secretKey,
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
    res.json({ success: true, data: { ipfsUri: `ipfs://${result.IpfsHash}` } });
  } catch (err) {
    console.error("[upload] Error:", err);
    res.status(500).json({
      success: false,
      error: { code: "UPLOAD_FAILED", message: (err as Error).message },
    });
  }
});

/**
 * POST /upload/json — Pin JSON metadata to IPFS. No auth required (public passport data).
 * Accepts { data: Record<string, unknown>, name?: string }.
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

    const { apiKey, secretKey } = getPinataCreds();

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: apiKey,
        pinata_secret_api_key: secretKey,
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

export default router;

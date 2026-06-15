import { Request, Response, NextFunction } from "express";
import { verifyMessage } from "viem";

const USED_NONCES = new Map<string, Set<string>>();

export async function requireSignedNonce(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const address = req.headers["x-wallet-address"] as `0x${string}` | undefined;
  const signature = req.headers["x-signature"] as `0x${string}` | undefined;
  const nonce = req.headers["x-nonce"] as string | undefined;

  if (!address || !signature || !nonce) {
    res.status(401).json({
      success: false,
      error: { code: "MISSING_AUTH", message: "Missing x-wallet-address, x-signature, or x-nonce headers" },
    });
    return;
  }

  const addressNonces = USED_NONCES.get(address.toLowerCase()) ?? new Set();
  if (addressNonces.has(nonce)) {
    res.status(401).json({
      success: false,
      error: { code: "NONCE_REUSED", message: "Nonce already used" },
    });
    return;
  }

  const message = `ArcPass:${req.originalUrl}:${nonce}`;
  try {
    const valid = await verifyMessage({ address, message, signature });
    if (!valid) {
      res.status(401).json({
        success: false,
        error: { code: "BAD_SIG", message: "Signature verification failed" },
      });
      return;
    }
  } catch {
    res.status(401).json({
      success: false,
      error: { code: "BAD_SIG", message: "Signature verification threw" },
    });
    return;
  }

  addressNonces.add(nonce);
  USED_NONCES.set(address.toLowerCase(), addressNonces);
  req.verifiedAddress = address;
  next();
}

declare global {
  namespace Express {
    interface Request {
      verifiedAddress?: `0x${string}`;
    }
  }
}

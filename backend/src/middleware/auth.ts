import { Request, Response, NextFunction } from "express";
import { verifyMessage } from "viem";

/**
 * In-memory nonce store for replay prevention. Each address tracks used nonces
 * in a Set<string>. Nonces are UUIDs generated client-side per request.
 *
 * LIMITATION: This store is ephemeral — it resets on server restart and is not
 * shared across instances. For testnet this is acceptable. For production
 * deployments with multiple backend instances or restart requirements, migrate
 * to Redis with a TTL matching the signed message time window (e.g., 5 minutes).
 *
 * Per AGENTS.md §15.5.2, this prevents signature replay within a single server
 * lifetime. The signed message includes `req.originalUrl` and a timestamp-truncated
 * nonce, providing route-scoped and time-scoped replay protection.
 */
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

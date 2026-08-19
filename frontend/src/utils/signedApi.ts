import { apiUrl } from "../config/api";

/**
 * Signed API helper for mutating/private endpoints.
 *
 * The backend `requireSignedNonce` middleware (backend/src/middleware/auth.ts)
 * verifies a signature over `ArcPass:${req.originalUrl}:${nonce}` with a
 * one-time nonce. The `path` passed here must exactly match what the backend
 * sees as `req.originalUrl` — including any query string.
 */
export interface SignedFetchOptions {
  path:     string;
  address:  `0x${string}`;
  signMessage: (args: { message: string }) => Promise<`0x${string}`>;
  method?:  string;
  body?:    unknown;
}

export async function signedFetch<T = unknown>(opts: SignedFetchOptions): Promise<T> {
  const nonce = crypto.randomUUID();
  const message = `ArcPass:${opts.path}:${nonce}`;
  const signature = await opts.signMessage({ message });

  const res = await fetch(apiUrl(opts.path), {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": opts.address,
      "x-nonce": nonce,
      "x-signature": signature,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const json = await res.json().catch(() => null);
  if (!json || typeof json !== "object") {
    // Backend always responds with the JSON envelope; a non-JSON body means the
    // request hit a proxy/dev-server error page instead of the API.
    throw new Error(`Request failed (${res.status}) — server returned a non-JSON response`);
  }
  if (!json.success) {
    throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  }
  return json.data as T;
}

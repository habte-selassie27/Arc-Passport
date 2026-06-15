/**
 * Returns the configured API base URL, with a safe fallback.
 *
 * If `VITE_API_BASE_URL` is not set, use the local backend in dev and the
 * Vercel backend route in production.
 *
 * Using a fallback rather than `undefined` is critical: a relative
 * fetch URL like `undefined/v1/passport/0x...` resolves against the
 * current page origin (the Vite dev server) which returns the SPA's
 * `index.html` — leading to JSON parse errors on `<!DOCTYPE`.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ||
  (import.meta.env.PROD ? "/_/backend" : "http://localhost:3001");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}

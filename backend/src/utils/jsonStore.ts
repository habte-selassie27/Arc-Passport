/**
 * Minimal JSON-file persistence helper.
 *
 * The backend deliberately has no database dependency (per AGENTS.md §12:
 * "use the minimum number of databases required"). Application state that must
 * survive restarts — notifications, attestation requests — is persisted to a
 * single JSON file in the backend root, mirroring the indexer's `.indexer-state.json`
 * pattern. This is acceptable for testnet/development; a relational database is
 * the documented upgrade path for production.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const STATE_DIR = resolve(import.meta.dirname ?? ".", "../..");

// In tests, keep everything in-memory: no state file is read or written, so
// tests are isolated and never pollute the repo with `.app-state.json`.
const IS_TEST = process.env.NODE_ENV === "test";

export function loadJsonFile<T>(filename: string, fallback: T): T {
  if (IS_TEST) return fallback;
  try {
    const path = resolve(STATE_DIR, filename);
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf8")) as T;
    }
  } catch {
    // corrupt or unreadable state file — start fresh
  }
  return fallback;
}

export function saveJsonFile<T>(filename: string, value: T): void {
  if (IS_TEST) return;
  try {
    writeFileSync(resolve(STATE_DIR, filename), JSON.stringify(value, null, 2));
  } catch {
    // never let persistence failures crash the API
  }
}

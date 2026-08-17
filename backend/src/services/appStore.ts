/**
 * App store — single JSON-persisted state for application-level records that
 * have no on-chain representation: notifications and attestation requests.
 *
 * Per AGENTS.md §12 the backend uses one lightweight store, not a database per
 * concern. Both `notificationService` and `requestService` mutate this one
 * state object, which is persisted to `.app-state.json` on every change.
 */
import { loadJsonFile, saveJsonFile } from "../utils/jsonStore.js";

export type NotificationType =
  | "attestation_received"
  | "attestation_revoked"
  | "credential_expiring"
  | "request_created"
  | "request_approved"
  | "request_rejected";

export interface AppNotification {
  id:        string;
  /** Lowercased recipient address. */
  recipient: string;
  type:      NotificationType;
  title:     string;
  body:      string;
  data:      Record<string, unknown>;
  /** Prevents duplicate notifications (e.g. repeated expiry sweeps for one claim). */
  dedupKey?: string;
  read:      boolean;
  createdAt: number;
}

export type RequestStatus = "pending" | "approved" | "rejected";

export interface AttestationRequest {
  id:         string;
  subject:    string; // lowercased
  issuer:     string; // lowercased
  schemaId:   `0x${string}`;
  schemaName: string;
  note:       string;
  status:     RequestStatus;
  createdAt:  number;
  decidedAt?: number;
}

interface AppState {
  notifications: AppNotification[];
  requests:      AttestationRequest[];
}

const STATE_FILE = ".app-state.json";
const MAX_NOTIFICATIONS = 200;

let state: AppState = loadJsonFile<AppState>(STATE_FILE, { notifications: [], requests: [] });

function persist(): void {
  saveJsonFile(STATE_FILE, state);
}

/** Test helper: reset in-memory state so tests are isolated. */
export function resetAppState(): void {
  state = { notifications: [], requests: [] };
}

// ─── Notifications ─────────────────────────────────────────────────────────

export function addNotification(n: AppNotification): void {
  if (n.dedupKey && state.notifications.some((x) => x.dedupKey === n.dedupKey)) return;
  state.notifications.unshift(n);
  if (state.notifications.length > MAX_NOTIFICATIONS) {
    state.notifications.length = MAX_NOTIFICATIONS;
  }
  persist();
}

export function listNotifications(recipient: string, limit = 50): AppNotification[] {
  const key = recipient.toLowerCase();
  return state.notifications.filter((n) => n.recipient === key).slice(0, limit);
}

export function unreadNotificationCount(recipient: string): number {
  const key = recipient.toLowerCase();
  return state.notifications.filter((n) => n.recipient === key && !n.read).length;
}

export function markNotificationRead(recipient: string, id: string): boolean {
  const key = recipient.toLowerCase();
  const n = state.notifications.find((x) => x.id === id && x.recipient === key);
  if (!n) return false;
  n.read = true;
  persist();
  return true;
}

export function markAllNotificationsRead(recipient: string): number {
  const key = recipient.toLowerCase();
  let count = 0;
  for (const n of state.notifications) {
    if (n.recipient === key && !n.read) {
      n.read = true;
      count++;
    }
  }
  if (count > 0) persist();
  return count;
}

// ─── Attestation requests ──────────────────────────────────────────────────

export function addRequest(r: AttestationRequest): void {
  state.requests.push(r);
  persist();
}

export function listRequests(recipient: string, role: "subject" | "issuer"): AttestationRequest[] {
  const key = recipient.toLowerCase();
  return state.requests.filter((r) => (role === "subject" ? r.subject : r.issuer) === key);
}

export function getRequest(id: string): AttestationRequest | undefined {
  return state.requests.find((r) => r.id === id);
}

export function updateRequest(id: string, patch: Partial<AttestationRequest>): AttestationRequest | undefined {
  const r = getRequest(id);
  if (!r) return undefined;
  Object.assign(r, patch);
  persist();
  return r;
}

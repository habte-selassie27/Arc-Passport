/**
 * Notification service — lightweight, store-backed notifications.
 *
 * Per ATTESTATIONS.md §20 and SECURITY-ROADMAP.md V1.5, notifications support:
 * new attestation, credential expiration/revocation, and attestation-request
 * activity. Implemented as simple records in the app store — no queue, no
 * real-time infrastructure (AGENTS.md §12: no WebSockets, poll/refresh only).
 */
import { randomUUID } from "node:crypto";
import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { getAllIndexedClaims } from "../indexer/claimIndexer.js";
import { resolveSchema } from "../utils/schemaLookup.js";
import {
  addNotification,
  listNotifications,
  unreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
  type NotificationType,
} from "./appStore.js";

const EXPIRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // notify 7 days before expiry
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;     // every 6 hours
const FIRST_SWEEP_DELAY_MS = 60_000;               // wait for indexer catch-up first

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as `0x${string}`;

export interface NotifyInput {
  recipient: string;
  type:      NotificationType;
  title:     string;
  body:      string;
  data?:     Record<string, unknown>;
  dedupKey?: string;
}

/** Create a notification for a recipient. Lowers the address; dedups by dedupKey. */
export function notify(input: NotifyInput): void {
  const notification: AppNotification = {
    id:        randomUUID(),
    recipient: input.recipient.toLowerCase(),
    type:      input.type,
    title:     input.title,
    body:      input.body,
    data:      input.data ?? {},
    dedupKey:  input.dedupKey,
    read:      false,
    createdAt: Date.now(),
  };
  addNotification(notification);
}

/** Human-readable schema name for a claim, falling back to the raw schemaId. */
export function schemaDisplayName(schemaId: string): string {
  return resolveSchema(schemaId)?.name ?? schemaId.slice(0, 10) + "…";
}

/** Notify a subject that an issuer issued them a credential (from the indexer). */
export function notifyClaimIssued(claim: {
  claimId:  string;
  subject:  string;
  issuer:   string;
  schemaId: string;
}): void {
  notify({
    recipient: claim.subject,
    type:      "attestation_received",
    title:     "Attestation received",
    body:      `${claim.issuer.slice(0, 6)}…${claim.issuer.slice(-4)} issued you "${schemaDisplayName(claim.schemaId)}"`,
    data:      { claimId: claim.claimId, issuer: claim.issuer, schemaId: claim.schemaId },
  });
}

/** Notify a subject that one of their credentials was revoked. */
export function notifyClaimRevoked(claim: {
  claimId: string;
  subject: string;
  revoker: string;
}): void {
  notify({
    recipient: claim.subject,
    type:      "attestation_revoked",
    title:     "Attestation revoked",
    body:      `A credential you hold (${claim.claimId.slice(0, 10)}…) was revoked`,
    data:      { claimId: claim.claimId, revoker: claim.revoker },
  });
}

// ─── Reads / mutations for routes ──────────────────────────────────────────

export function getNotifications(recipient: string, limit = 50): AppNotification[] {
  return listNotifications(recipient, limit);
}

export function getUnreadCount(recipient: string): number {
  return unreadNotificationCount(recipient);
}

export function markRead(recipient: string, id: string): boolean {
  return markNotificationRead(recipient, id);
}

export function markAllRead(recipient: string): number {
  return markAllNotificationsRead(recipient);
}

// ─── Expiry sweep ──────────────────────────────────────────────────────────

/**
 * Start the expiry-notification sweep. Runs once shortly after boot (after the
 * indexer catch-up) and then every `intervalMs`. Claims expiring within 7 days
 * generate one "credential_expiring" notification per claim (deduped by claimId).
 *
 * Lightweight by design: one multicall per sweep over the indexed claims, no
 * queue, no scheduler dependency.
 */
export function startExpirySweep(intervalMs = SWEEP_INTERVAL_MS): void {
  if (!ADDRESSES.attestationRegistry) {
    console.warn("[notifications] AttestationRegistry not configured, expiry sweep disabled");
    return;
  }
  setTimeout(() => { void runExpirySweep().catch((err) => console.error("[notifications] expiry sweep failed:", (err as Error).message)); }, FIRST_SWEEP_DELAY_MS);
  setInterval(() => { void runExpirySweep().catch((err) => console.error("[notifications] expiry sweep failed:", (err as Error).message)); }, intervalMs);
  console.log(`[notifications] Expiry sweep scheduled every ${intervalMs / 3_600_000}h`);
}

/** Run one expiry sweep; returns the number of notifications created. */
export async function runExpirySweep(): Promise<number> {
  const claims = getAllIndexedClaims();
  if (claims.length === 0) return 0;

  let created = 0;
  const now = Date.now();
  const windowEnd = now + EXPIRY_WINDOW_MS;

  try {
    const results = await publicClient.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      contracts: claims.map((c) => ({
        address:      ADDRESSES.attestationRegistry!,
        abi:          ATTESTATION_REGISTRY_ABI,
        functionName: "getClaim" as const,
        args:         [c.claimId as `0x${string}`],
      })),
    });

    results.forEach((r, i) => {
      const claim = claims[i];
      if (r.status !== "success" || !r.result) return;
      const decoded = r.result as unknown as
        | (bigint | string | boolean)[]
        | { expiresAt: bigint; revoked: boolean };
      const expiresAt = Array.isArray(decoded) ? Number(decoded[6] ?? 0n) : Number(decoded.expiresAt ?? 0n);
      const revoked   = Array.isArray(decoded) ? Boolean(decoded[7]) : Boolean(decoded.revoked);
      // expiresAt == 0 means no expiry
      if (expiresAt === 0 || revoked) return;
      const expiresMs = expiresAt * 1000;
      if (expiresMs > now && expiresMs <= windowEnd) {
        const dedupKey = `expiry:${claim.claimId}`;
        notify({
          recipient: claim.subject,
          type:      "credential_expiring",
          title:     "Credential expiring soon",
          body:      `Your credential ${claim.schemaId.slice(0, 10)}… expires in less than 7 days`,
          data:      { claimId: claim.claimId, schemaId: claim.schemaId, expiresAt: expiresMs },
          dedupKey,
        });
        created++;
      }
    });
  } catch (err) {
    console.error("[notifications] expiry sweep multicall failed:", (err as Error).message);
  }

  return created;
}

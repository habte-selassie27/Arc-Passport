import { describe, it, expect, beforeEach } from "vitest";
import {
  notify,
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  schemaDisplayName,
} from "../../services/notificationService.js";
import { resetAppState } from "../../services/appStore.js";
import { listAllSchemas } from "../../utils/schemaLookup.js";

const ADDR_A = "0x1111111111111111111111111111111111111111";
const ADDR_B = "0x2222222222222222222222222222222222222222";

beforeEach(() => {
  resetAppState();
});

describe("notificationService", () => {
  it("creates and lists notifications for a recipient (lowercased)", () => {
    notify({ recipient: ADDR_A, type: "attestation_received", title: "Attestation received", body: "body" });
    const list = getNotifications(ADDR_A);
    expect(list).toHaveLength(1);
    expect(list[0].recipient).toBe(ADDR_A.toLowerCase());
    expect(list[0].read).toBe(false);
  });

  it("dedups notifications sharing a dedupKey (expiry sweeps)", () => {
    const opts = { recipient: ADDR_A, type: "credential_expiring" as const, title: "Expiring", body: "b", dedupKey: "expiry:0xclaim" };
    notify(opts);
    notify(opts);
    expect(getNotifications(ADDR_A)).toHaveLength(1);
  });

  it("does not leak notifications across recipients", () => {
    notify({ recipient: ADDR_A, type: "attestation_received", title: "T", body: "b" });
    expect(getNotifications(ADDR_B)).toHaveLength(0);
    expect(getUnreadCount(ADDR_B)).toBe(0);
  });

  it("tracks unread counts and marks individual notifications read", () => {
    notify({ recipient: ADDR_A, type: "attestation_received", title: "T1", body: "b" });
    notify({ recipient: ADDR_A, type: "request_created", title: "T2", body: "b" });
    expect(getUnreadCount(ADDR_A)).toBe(2);

    const first = getNotifications(ADDR_A)[0];
    expect(markRead(ADDR_A, first.id)).toBe(true);
    expect(getUnreadCount(ADDR_A)).toBe(1);
    expect(getNotifications(ADDR_A).find((n) => n.id === first.id)?.read).toBe(true);
  });

  it("markRead returns false for unknown or foreign notifications", () => {
    notify({ recipient: ADDR_A, type: "attestation_received", title: "T", body: "b" });
    const id = getNotifications(ADDR_A)[0].id;
    expect(markRead(ADDR_A, "nope")).toBe(false);
    expect(markRead(ADDR_B, id)).toBe(false);
  });

  it("marks all notifications read for a recipient", () => {
    notify({ recipient: ADDR_A, type: "attestation_received", title: "T1", body: "b" });
    notify({ recipient: ADDR_A, type: "request_created", title: "T2", body: "b" });
    notify({ recipient: ADDR_B, type: "attestation_received", title: "T3", body: "b" });

    expect(markAllRead(ADDR_A)).toBe(2);
    expect(getUnreadCount(ADDR_A)).toBe(0);
    // other recipient unaffected
    expect(getUnreadCount(ADDR_B)).toBe(1);
  });

  it("resolves a schema display name for known schema ids", () => {
    const known = listAllSchemas()[0];
    expect(schemaDisplayName(known.id)).toBe(known.name);
  });
});

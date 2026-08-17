import { describe, it, expect, beforeEach } from "vitest";
import {
  createRequest,
  listRequestsFor,
  decideRequest,
} from "../../services/requestService.js";
import { resetAppState, getRequest } from "../../services/appStore.js";
import { getNotifications } from "../../services/notificationService.js";
import { listAllSchemas } from "../../utils/schemaLookup.js";

const SCHEMA = listAllSchemas()[0];
const SUBJECT = "0x1111111111111111111111111111111111111111";
const ISSUER  = "0x2222222222222222222222222222222222222222";

beforeEach(() => {
  resetAppState();
});

describe("requestService", () => {
  it("creates a pending request with the resolved schema name", () => {
    const r = createRequest({ subject: SUBJECT, issuer: ISSUER, schemaId: SCHEMA.id, note: "please" });
    expect(r.status).toBe("pending");
    expect(r.schemaName).toBe(SCHEMA.name);
    expect(r.subject).toBe(SUBJECT.toLowerCase());
    expect(r.issuer).toBe(ISSUER.toLowerCase());
    expect(r.note).toBe("please");
  });

  it("rejects unknown schema ids", () => {
    const unknown = ("0x" + "1".repeat(64)) as `0x${string}`;
    expect(() => createRequest({ subject: SUBJECT, issuer: ISSUER, schemaId: unknown })).toThrow();
  });

  it("lists requests by subject and issuer role", () => {
    createRequest({ subject: SUBJECT, issuer: ISSUER, schemaId: SCHEMA.id });
    expect(listRequestsFor(SUBJECT, "subject")).toHaveLength(1);
    expect(listRequestsFor(ISSUER, "issuer")).toHaveLength(1);
    expect(listRequestsFor(SUBJECT, "issuer")).toHaveLength(0);
    expect(listRequestsFor(ISSUER, "subject")).toHaveLength(0);
  });

  it("only the request's issuer can decide it", () => {
    const r = createRequest({ subject: SUBJECT, issuer: ISSUER, schemaId: SCHEMA.id });
    expect(() => decideRequest(r.id, SUBJECT, "approved")).toThrow();
  });

  it("approves a pending request and records decidedAt", () => {
    const r = createRequest({ subject: SUBJECT, issuer: ISSUER, schemaId: SCHEMA.id });
    const updated = decideRequest(r.id, ISSUER, "approved");
    expect(updated.status).toBe("approved");
    expect(updated.decidedAt).toBeTypeOf("number");
    expect(getRequest(r.id)?.status).toBe("approved");
  });

  it("rejects a pending request", () => {
    const r = createRequest({ subject: SUBJECT, issuer: ISSUER, schemaId: SCHEMA.id });
    const updated = decideRequest(r.id, ISSUER, "rejected");
    expect(updated.status).toBe("rejected");
  });

  it("cannot decide an already-decided request", () => {
    const r = createRequest({ subject: SUBJECT, issuer: ISSUER, schemaId: SCHEMA.id });
    decideRequest(r.id, ISSUER, "approved");
    expect(() => decideRequest(r.id, ISSUER, "rejected")).toThrow();
  });

  it("throws for unknown request ids", () => {
    expect(() => decideRequest("nope", ISSUER, "approved")).toThrow();
  });

  it("notifies the issuer on create and the subject on decide", () => {
    const r = createRequest({ subject: SUBJECT, issuer: ISSUER, schemaId: SCHEMA.id });
    decideRequest(r.id, ISSUER, "approved");

    const issuerNotes = getNotifications(ISSUER);
    const subjectNotes = getNotifications(SUBJECT);

    expect(issuerNotes.some((n) => n.type === "request_created")).toBe(true);
    expect(subjectNotes.some((n) => n.type === "request_approved")).toBe(true);
  });
});

/**
 * Attestation request service.
 *
 * Per ATTESTATIONS.md §15: a user requests a credential from an issuer, the
 * issuer reviews and approves/rejects, and then issues via the normal issuance
 * flow. This service manages the request records and notifies both parties.
 * Deliberately lightweight — no messaging system, just consent + review records.
 */
import { randomUUID } from "node:crypto";
import {
  addRequest,
  getRequest,
  listRequests,
  updateRequest,
  type AttestationRequest,
  type RequestStatus,
} from "./appStore.js";
import { resolveSchema } from "../utils/schemaLookup.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import { notify } from "./notificationService.js";

export interface CreateRequestInput {
  subject:  `0x${string}`;
  issuer:   `0x${string}`;
  schemaId: `0x${string}`;
  note?:    string;
}

/** Create a credential request from a subject to an issuer. */
export function createRequest(input: CreateRequestInput): AttestationRequest {
  const schema = resolveSchema(input.schemaId);
  if (!schema) throw Errors.SchemaNotFound(input.schemaId);

  const request: AttestationRequest = {
    id:         randomUUID(),
    subject:    input.subject.toLowerCase(),
    issuer:     input.issuer.toLowerCase(),
    schemaId:   schema.id,
    schemaName: schema.name,
    note:       input.note ?? "",
    status:     "pending",
    createdAt:  Date.now(),
  };

  addRequest(request);

  notify({
    recipient: request.issuer,
    type:      "request_created",
    title:     "New credential request",
    body:      `${request.subject.slice(0, 6)}…${request.subject.slice(-4)} requested "${request.schemaName}"`,
    data:      {
      requestId: request.id,
      subject:   request.subject,
      schemaId:  request.schemaId,
      schemaName: request.schemaName,
      note:      request.note,
    },
  });

  return request;
}

/** List requests where `address` is the subject or the issuer. */
export function listRequestsFor(address: string, role: "subject" | "issuer"): AttestationRequest[] {
  return listRequests(address, role);
}

/**
 * Approve or reject a request. Only the request's issuer may decide, and only
 * while the request is still pending. Approving does NOT mint the credential —
 * the issuer completes issuance through the normal issue flow (ATTESTATIONS.md §15).
 */
export function decideRequest(id: string, by: string, decision: "approved" | "rejected"): AttestationRequest {
  const request = getRequest(id);
  if (!request) throw new ArcPassError("REQUEST_NOT_FOUND", `Request ${id} not found`, 404);
  if (request.issuer !== by.toLowerCase()) throw Errors.NotIssuer(by);
  if (request.status !== "pending") {
    throw new ArcPassError("REQUEST_ALREADY_DECIDED", `Request ${id} already ${request.status}`, 409);
  }

  const updated = updateRequest(id, { status: decision as RequestStatus, decidedAt: Date.now() });
  if (!updated) throw new ArcPassError("REQUEST_NOT_FOUND", `Request ${id} not found`, 404);

  notify({
    recipient: updated.subject,
    type:      decision === "approved" ? "request_approved" : "request_rejected",
    title:     decision === "approved" ? "Credential request approved" : "Credential request declined",
    body:      `Your request for "${updated.schemaName}" was ${decision}`,
    data:      {
      requestId:  updated.id,
      issuer:     updated.issuer,
      schemaId:   updated.schemaId,
      schemaName: updated.schemaName,
      status:     decision,
    },
  });

  return updated;
}

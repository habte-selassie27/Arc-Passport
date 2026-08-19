import { useState } from "react";
import { useRequests, type AttestationRequest } from "../../hooks/useRequests";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { StatusChip } from "../ui/StatusChip";
import type { ClaimStatus } from "../ui/StatusChip";

const STATUS_MAP: Record<string, ClaimStatus> = {
  pending: "PENDING",
  approved: "VALID",
  rejected: "REVOKED",
};

export function CredentialRequestList({ address }: { address: `0x${string}` }) {
  const { requests, isLoading, error, load, decide } = useRequests(address);
  const [busy, setBusy] = useState<string | null>(null);
  const loaded = requests.length > 0 || error || isLoading;

  const handleDecide = async (id: string, decision: "approved" | "rejected") => {
    setBusy(id);
    await decide(id, decision);
    setBusy(null);
  };

  const renderStatus = (r: AttestationRequest) => {
    const status = STATUS_MAP[r.status] ?? "PENDING";
    return <StatusChip status={status} dot={false} />;
  };

  return (
    <Card>
      <h3 className="display--medium t-lg" style={{ marginBottom: "var(--space-1)" }}>Credential requests</h3>
      <p className="t-xs c-muted" style={{ marginBottom: "var(--space-4)" }}>
        Review requests from users. Approve or reject, then issue via the attestation form above.
      </p>

      {!loaded && (
        <div style={{ textAlign: "center" }}>
          <Button variant="ghost" size="sm" onClick={() => void load("issuer")}>
            Load requests
          </Button>
        </div>
      )}

      {isLoading && requests.length === 0 && (
        <div className="flex items-center justify-center gap-2 c-muted t-sm" style={{ padding: "var(--space-6)" }}>
          <span className="spinner" style={{ width: 12, height: 12 }} aria-hidden="true" />
          Loading requests…
        </div>
      )}

      {error && !isLoading && requests.length === 0 && (
        <div className="sim-box--failed sim-box" style={{ margin: "var(--space-4) 0" }}>
          <p className="sim-box__row"><span className="sim-box__fail" aria-hidden="true">✗</span> {error}</p>
        </div>
      )}

      {!isLoading && !error && requests.length === 0 && loaded && (
        <EmptyState
          title="No credential requests yet"
          body="When users request credentials from this issuer, they will appear here."
        />
      )}

      {requests.length > 0 && (
        <div className="space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex items-start justify-between gap-3"
              style={{
                padding: "var(--space-3) var(--space-4)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                background: r.status === "pending" ? "rgba(59,130,246,0.03)" : "transparent",
              }}
            >
              <div className="min-w-0" style={{ flex: 1 }}>
                <p className="t-sm" style={{ fontWeight: 500, color: "var(--color-on-bright)" }}>
                  {r.schemaName}
                  <span style={{ marginLeft: "var(--space-2)" }}>{renderStatus(r)}</span>
                </p>
                <p className="mono t-xs c-subtle" style={{ marginTop: 2 }}>
                  {r.subject.slice(0, 6)}…{r.subject.slice(-4)} · {new Date(r.createdAt).toLocaleString()}
                </p>
                {r.note && <p className="t-xs c-muted italic" style={{ marginTop: "var(--space-1)" }}>"{r.note}"</p>}
              </div>

              {r.status === "pending" && (
                <div className="flex gap-2" style={{ flexShrink: 0 }}>
                  <Button variant="success" size="sm" loading={busy === r.id} disabled={busy === r.id} onClick={() => void handleDecide(r.id, "approved")}>
                    Approve
                  </Button>
                  <Button variant="danger" size="sm" loading={busy === r.id} disabled={busy === r.id} onClick={() => void handleDecide(r.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

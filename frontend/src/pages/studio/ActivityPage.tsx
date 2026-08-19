import { useAnalytics } from "../../hooks/useAnalytics";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";

export function ActivityPage() {
  const { data: analytics, isLoading } = useAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="display--medium t-xl">Activity</h1>
        <Card style={{ textAlign: "center", padding: "var(--space-8)" }}>
          <p className="t-sm c-muted">Loading activity...</p>
        </Card>
      </div>
    );
  }

  const events = analytics?.events;
  if (!events) {
    return (
      <div className="space-y-6">
        <h1 className="display--medium t-xl">Activity</h1>
        <Card>
          <EmptyState
            title="No activity yet"
            body="Activity from on-chain events will appear here."
          />
        </Card>
      </div>
    );
  }

  const sections = [
    { label: "Claims Issued", count: events.ClaimIssued?.total ?? 0, rate: events.ClaimIssued?.lastHour ?? 0, color: "var(--color-verified)" },
    { label: "Claims Revoked", count: events.ClaimRevoked?.total ?? 0, rate: events.ClaimRevoked?.lastHour ?? 0, color: "var(--color-danger)" },
    { label: "Schemas Registered", count: events.SchemaRegistered?.total ?? 0, rate: events.SchemaRegistered?.lastHour ?? 0, color: "var(--color-arc-primary)" },
    { label: "Role Grants", count: events.RoleGranted?.total ?? 0, rate: events.RoleGranted?.lastHour ?? 0, color: "var(--color-warn)" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="display--medium t-xl">Activity</h1>

      <div className="space-y-3">
        {sections.map((s) => (
          <Card key={s.label} style={{ padding: "var(--space-4) var(--space-5)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }}
                  aria-hidden="true"
                />
                <span className="t-sm" style={{ color: "var(--color-on-bright)" }}>{s.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>{s.count}</span>
                {s.rate > 0 && (
                  <span className="mono t-xs c-subtle">+{s.rate}/hr</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {analytics?.generatedAt && (
        <p className="t-xs c-subtle">
          Last updated: {new Date(analytics.generatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

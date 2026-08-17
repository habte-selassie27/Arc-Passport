import { useEffect, useState } from "react";
import { StatCard } from "../ui/StatCard";

interface EventAnalytics {
  lastMinute: number;
  lastHour: number;
  total: number;
}

interface AnalyticsData {
  events: Record<string, EventAnalytics>;
  generatedAt: number;
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001"}/v1/analytics`);
        const json = await res.json();
        if (mounted && json.success) {
          setData(json.data);
          setIsLive(true);
          setError(null);
        } else if (mounted) {
          setError("Failed to load analytics");
          setIsLive(false);
        }
      } catch {
        if (mounted) {
          setError("Backend offline");
          setIsLive(false);
        }
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const claimIssued = data?.events?.ClaimIssued ?? { lastMinute: 0, lastHour: 0, total: 0 };
  const claimRevoked = data?.events?.ClaimRevoked ?? { lastMinute: 0, lastHour: 0, total: 0 };
  const schemasRegistered = data?.events?.SchemaRegistered ?? { lastMinute: 0, lastHour: 0, total: 0 };
  const roleGrants = data?.events?.RoleGranted ?? { lastMinute: 0, lastHour: 0, total: 0 };

  const displayTotal = (val: number) => (error ? "—" : val);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div className="flex items-center justify-between">
        <h3 className="display--medium t-lg">Analytics</h3>
        <span className="flex items-center gap-2 mono t-xs c-subtle">
          <span
            className={`live-dot live-dot--${isLive ? "on" : "off"}`}
            style={{ display: "inline-block" }}
            aria-hidden="true"
          />
          {isLive ? "Live" : "Offline"}
        </span>
      </div>

      {error && (
        <div
          role="status"
          className="chip chip--pending"
          style={{ alignSelf: "flex-start", textTransform: "none", letterSpacing: "0.04em" }}
        >
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Claims issued" value={displayTotal(claimIssued.total)} sub="Total" />
        <StatCard label="Claims revoked" value={displayTotal(claimRevoked.total)} tone="danger" sub="Total" />
        <StatCard label="Schemas registered" value={displayTotal(schemasRegistered.total)} sub="Total" />
        <StatCard label="Role grants" value={displayTotal(roleGrants.total)} tone="warn" sub="Total" />
      </div>

      <div style={{ background: "var(--color-surface-1)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
        <h4 className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>
          Real-time activity
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="t-xs c-subtle">Claims/min</p>
            <p className="mono t-2xl c-primary" style={{ lineHeight: 1.2, marginTop: "var(--space-1)" }}>
              {displayTotal(claimIssued.lastMinute)}
            </p>
          </div>
          <div>
            <p className="t-xs c-subtle">Revocations/min</p>
            <p className="mono t-2xl c-danger" style={{ lineHeight: 1.2, marginTop: "var(--space-1)" }}>
              {displayTotal(claimRevoked.lastMinute)}
            </p>
          </div>
          <div>
            <p className="t-xs c-subtle">Claims/hour</p>
            <p className="mono t-2xl c-primary" style={{ lineHeight: 1.2, marginTop: "var(--space-1)" }}>
              {displayTotal(claimIssued.lastHour)}
            </p>
          </div>
          <div>
            <p className="t-xs c-subtle">Schemas/hour</p>
            <p className="mono t-2xl" style={{ lineHeight: 1.2, marginTop: "var(--space-1)", color: "var(--color-warn)" }}>
              {displayTotal(schemasRegistered.lastHour)}
            </p>
          </div>
        </div>
      </div>

      {data?.generatedAt && (
        <p className="t-xs c-subtle">
          Last updated: {new Date(data.generatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

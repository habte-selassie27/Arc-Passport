import { AnalyticsDashboard } from "../../components/studio/AnalyticsDashboard";

export function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display--medium t-xl" style={{ marginBottom: "var(--space-1)" }}>Analytics</h1>
        <p className="t-sm c-muted">Real-time attestation and schema activity across your issuer wallet.</p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}

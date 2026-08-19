import { RevokeDashboard } from "../../components/studio/RevokeDashboard";

export function RevokePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display--medium t-xl" style={{ marginBottom: "var(--space-1)" }}>Revoke Credential</h1>
        <p className="t-sm c-muted">Look up a claim and revoke it on-chain.</p>
      </div>
      <RevokeDashboard />
    </div>
  );
}

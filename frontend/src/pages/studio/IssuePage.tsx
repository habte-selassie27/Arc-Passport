import { IssueDashboard } from "../../components/studio/IssueDashboard";

export function IssuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display--medium t-xl" style={{ marginBottom: "var(--space-1)" }}>Issue Credential</h1>
        <p className="t-sm c-muted">Issue a single attestation to a wallet address.</p>
      </div>
      <IssueDashboard />
    </div>
  );
}

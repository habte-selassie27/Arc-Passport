import { BulkIssue } from "../../components/studio/BulkIssue";

export function BulkIssuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display--medium t-xl" style={{ marginBottom: "var(--space-1)" }}>Bulk Issue</h1>
        <p className="t-sm c-muted">Issue attestations in bulk via CSV upload.</p>
      </div>
      <BulkIssue />
    </div>
  );
}

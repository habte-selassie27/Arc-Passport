import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";

export function CredentialsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display--medium t-xl" style={{ marginBottom: "var(--space-1)" }}>Credentials</h1>
          <p className="t-sm c-muted">View and manage all attestations issued by this wallet.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/studio/credentials/issue">
            <Button variant="primary" size="sm">+ Issue</Button>
          </Link>
          <Link to="/studio/credentials/bulk">
            <Button variant="ghost" size="sm">Bulk Issue</Button>
          </Link>
        </div>
      </div>

      <div className="card" style={{ textAlign: "center", padding: "var(--space-10)" }}>
        <p className="t-sm c-muted" style={{ marginBottom: "var(--space-4)" }}>
          Credential list coming soon. Use the Issue or Bulk Issue pages to get started.
        </p>
        <div className="flex justify-center gap-2">
          <Link to="/studio/credentials/issue">
            <Button variant="primary" size="sm">Issue Credential</Button>
          </Link>
          <Link to="/studio/credentials/bulk">
            <Button variant="ghost" size="sm">Bulk Issue</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

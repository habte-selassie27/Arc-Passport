import { Link } from "react-router-dom";
import { useWallet } from "../../contexts/WalletContext";
import { useAnalytics } from "../../hooks/useAnalytics";
import { Card } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { Button } from "../../components/ui/Button";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const { address } = useWallet();
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useAnalytics();

  const claimIssued = analytics?.events?.ClaimIssued?.total ?? 0;
  const claimRevoked = analytics?.events?.ClaimRevoked?.total ?? 0;
  const schemasRegistered = analytics?.events?.SchemaRegistered?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display--medium t-xl" style={{ marginBottom: "var(--space-1)" }}>
          {getGreeting()}
        </h1>
        <p className="t-sm c-muted">
          {address ? `Issuer: ${address.slice(0, 6)}...${address.slice(-4)}` : "Issuer Workspace"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/studio/issue">
          <Button variant="primary" size="sm">+ Issue Credential</Button>
        </Link>
        <Link to="/studio/schemas/new">
          <Button variant="ghost" size="sm">Create Schema</Button>
        </Link>
      </div>

      {analyticsError && (
        <p className="t-sm" style={{ color: "var(--color-danger)" }}>Failed to fetch</p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Issued"
          value={analyticsLoading ? "—" : claimIssued}
          sub="Total"
        />
        <StatCard
          label="Active"
          value={analyticsLoading ? "—" : claimIssued - claimRevoked}
          sub="Valid"
        />
        <StatCard
          label="Revoked"
          value={analyticsLoading ? "—" : claimRevoked}
          tone="danger"
          sub="Total"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Schemas"
          value={analyticsLoading ? "—" : schemasRegistered}
          sub="Registered"
        />
      </div>

      <Card>
        <h3 className="display--medium t-lg" style={{ marginBottom: "var(--space-4)" }}>Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/studio/issue" className="action-card" style={{ margin: 0 }}>
            <span className="action-card__icon">+</span>
            <span className="flex-1">
              <span className="action-card__title">Issue credential</span>
              <span className="action-card__desc">Issue a single attestation</span>
            </span>
            <span className="action-card__arrow" aria-hidden="true">→</span>
          </Link>
          <Link to="/studio/schemas/new" className="action-card" style={{ margin: 0 }}>
            <span className="action-card__icon">≡</span>
            <span className="flex-1">
              <span className="action-card__title">Create schema</span>
              <span className="action-card__desc">Define a new claim schema</span>
            </span>
            <span className="action-card__arrow" aria-hidden="true">→</span>
          </Link>
          <Link to="/studio/revoke" className="action-card" style={{ margin: 0 }}>
            <span className="action-card__icon">✕</span>
            <span className="flex-1">
              <span className="action-card__title">Revoke credential</span>
              <span className="action-card__desc">Revoke an existing attestation</span>
            </span>
            <span className="action-card__arrow" aria-hidden="true">→</span>
          </Link>
          <Link to="/studio/schemas" className="action-card" style={{ margin: 0 }}>
            <span className="action-card__icon">≡</span>
            <span className="flex-1">
              <span className="action-card__title">View schemas</span>
              <span className="action-card__desc">Browse registered schemas</span>
            </span>
            <span className="action-card__arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}

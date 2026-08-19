import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { useWallet } from "../../contexts/WalletContext";
import { useIssuerCheck } from "../../hooks/useIssuerCheck";
import { DashboardPage } from "./DashboardPage";
import { CredentialsPage } from "./CredentialsPage";
import { IssuePage } from "./IssuePage";
import { BulkIssuePage } from "./BulkIssuePage";
import { RevokePage } from "./RevokePage";
import { SchemasPage } from "./SchemasPage";
import { CreateSchemaPage } from "./CreateSchemaPage";
import { TemplatesPage } from "./TemplatesPage";
import { ActivityPage } from "./ActivityPage";
import { SettingsPage } from "./SettingsPage";
import { ScorersPage } from "./ScorersPage";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { AddressDisplay } from "../../components/ui/AddressDisplay";

const SIDEBAR_SECTIONS: Array<{
  label: string;
  items: Array<{ to: string; label: string; icon: string; exact?: boolean }>;
}> = [
  {
    label: "STUDIO",
    items: [
      { to: "/studio", label: "Dashboard", icon: "◉", exact: true },
    ],
  },
  {
    label: "CREDENTIALS",
    items: [
      { to: "/studio/credentials", label: "All Credentials", icon: "◻" },
      { to: "/studio/credentials/issue", label: "Issue", icon: "+" },
      { to: "/studio/credentials/bulk", label: "Bulk Issue", icon: "◻◻" },
      { to: "/studio/credentials/revoke", label: "Revoke", icon: "✕" },
    ],
  },
  {
    label: "SCHEMAS",
    items: [
      { to: "/studio/schemas", label: "My Schemas", icon: "≡" },
      { to: "/studio/schemas/new", label: "Create Schema", icon: "+" },
      { to: "/studio/templates", label: "Templates", icon: "◫" },
    ],
  },
  {
    label: "SCORES",
    items: [
      { to: "/studio/scorers", label: "Scorers", icon: "◈" },
    ],
  },
  {
    label: "",
    items: [
      { to: "/studio/activity", label: "Activity", icon: "↻" },
      { to: "/studio/settings", label: "Settings", icon: "⚙" },
    ],
  },
];

function StudioSidebar() {
  const { pathname } = useLocation();
  const { address } = useWallet();

  const isActive = (to: string, exact = false) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <aside className="studio-sidebar">
      <div className="studio-sidebar__header">
        <Link to="/" className="studio-sidebar__brand">
          ArcPass
        </Link>
        <span className="studio-sidebar__subtitle">Studio</span>
      </div>

      <nav className="studio-sidebar__nav" aria-label="Studio navigation">
        {SIDEBAR_SECTIONS.map((section, si) => (
          <div key={si} className="studio-sidebar__section">
            {section.label && (
              <span className="studio-sidebar__section-label">{section.label}</span>
            )}
            {section.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`studio-sidebar__link ${isActive(item.to, item.exact) ? "studio-sidebar__link--active" : ""}`}
                aria-current={isActive(item.to, item.exact) ? "page" : undefined}
              >
                <span className="studio-sidebar__icon" aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {address && (
        <div className="studio-sidebar__footer">
          <div className="studio-sidebar__wallet">
            <span className="t-xs c-subtle">Connected</span>
            <span className="mono t-xs" style={{ color: "var(--color-on-bright)" }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}

/** Issuer role gating — shown before any Studio content */
function IssuerGate({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useWallet();
  const { isIssuer, isLoading, error, check } = useIssuerCheck(address);

  if (!isConnected) {
    return (
      <div className="studio-empty">
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Studio"
          description="Issue attestations, manage schemas, and revoke claims. Requires ISSUER_ROLE on the AttestationRegistry."
        />
        <EmptyState
          title="Connect your wallet"
          body="Connect a wallet to check whether it holds issuer permissions on-chain."
        />
      </div>
    );
  }

  if (isIssuer === null && !isLoading) {
    return (
      <div className="studio-empty">
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Studio"
          description="Verify your issuer permissions to access the workspace."
        />
        <Card style={{ textAlign: "center" }}>
          <p className="t-sm c-muted" style={{ marginBottom: "var(--space-4)" }}>
            Click below to verify your issuer permissions on-chain. This requires a wallet signature.
          </p>
          <Button onClick={() => void check()}>Verify Issuer Role</Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="studio-empty">
        <PageHeader
          eyebrow="Issuer access"
          title="Verifying issuer permissions..."
          description="Check your wallet for a signature request."
        />
        <Card style={{ textAlign: "center" }}>
          <Spinner size={20} style={{ margin: "0 auto var(--space-4)", display: "block" }} aria-hidden="true" />
          <Button variant="ghost" disabled loading>
            Waiting for wallet...
          </Button>
        </Card>
      </div>
    );
  }

  if (error && isIssuer === null) {
    return (
      <div className="studio-empty">
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Studio"
          description="Issue attestations, manage schemas, and revoke claims."
        />
        <ErrorState
          title="Verification failed"
          body={<p className="t-xs c-subtle">{error}</p>}
          onRetry={() => void check()}
        />
      </div>
    );
  }

  if (isIssuer === false) {
    return (
      <div className="studio-empty">
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Studio"
          description="Issue attestations, manage schemas, and revoke claims."
        />
        <Card revoked role="alert">
          <p className="error-state__title">
            <span aria-hidden="true">✗</span> Issuer role not found
          </p>
          <div style={{ marginTop: "var(--space-3)" }}>
            <div className="data-row">
              <span className="data-row__label">Connected wallet</span>
              <span className="data-row__value">
                {address && <AddressDisplay address={address} />}
              </span>
            </div>
          </div>
          <p className="card__desc" style={{ marginTop: "var(--space-3)" }}>
            This address does not hold ISSUER_ROLE on the AttestationRegistry contract.
          </p>
          <div style={{ marginTop: "var(--space-4)" }}>
            <Link to="/">
              <Button variant="ghost" size="sm">← Back to home</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export function StudioLayout() {
  const { address } = useWallet();

  return (
    <IssuerGate>
      <div className="studio-layout">
        <StudioSidebar />
        <div className="studio-content">
          <div className="studio-content__header">
            <span className="t-xs c-subtle mono">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
            </span>
          </div>
          <div className="studio-content__body">
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="credentials" element={<CredentialsPage />} />
              <Route path="credentials/issue" element={<IssuePage />} />
              <Route path="credentials/bulk" element={<BulkIssuePage />} />
              <Route path="credentials/revoke" element={<RevokePage />} />
              <Route path="schemas" element={<SchemasPage />} />
              <Route path="schemas/new" element={<CreateSchemaPage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="scorers" element={<ScorersPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/studio" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </IssuerGate>
  );
}

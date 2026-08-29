import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { useWallet } from "../../contexts/WalletContext";
import { useIssuerCheck } from "../../hooks/useIssuerCheck";
import { DashboardPage } from "./DashboardPage";
import { IssuePage } from "./IssuePage";
import { BulkIssuePage } from "./BulkIssuePage";
import { RevokePage } from "./RevokePage";
import { SchemasPage } from "./SchemasPage";
import { CreateSchemaPage } from "./CreateSchemaPage";
import { TemplatesPage } from "./TemplatesPage";
import { AnalyticsPage } from "./AnalyticsPage";
import { SettingsPage } from "./SettingsPage";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { AddressDisplay } from "../../components/ui/AddressDisplay";

const TABS: Array<{ to: string; label: string; exact?: boolean }> = [
  { to: "/studio", label: "Overview", exact: true },
  { to: "/studio/schemas", label: "Schemas" },
  { to: "/studio/templates", label: "Templates" },
  { to: "/studio/issue", label: "Issue" },
  { to: "/studio/bulk-issue", label: "Bulk Issue" },
  { to: "/studio/revoke", label: "Revoke" },
  { to: "/studio/analytics", label: "Analytics" },
  { to: "/studio/settings", label: "Settings" },
];

function StudioHeader() {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
  return (
    <div className="studio-header">
      <div>
        <h1 className="studio-header__title">ArcPass Studio</h1>
        <p className="studio-header__subtitle">
          Issuer dashboard for managing schemas, issuing attestations, and monitoring analytics across all 9 service verticals.
        </p>
      </div>
      <div className="studio-header__actions">
        <a href={`${apiBase}/docs`} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">API Docs (Swagger)</Button>
        </a>
        <a href={`${apiBase}/v1/openapi.json`} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">openapi.json</Button>
        </a>
      </div>
    </div>
  );
}

function StudioTabNav() {
  const { pathname } = useLocation();

  const isActive = (to: string, exact = false) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <nav className="studio-tabs" aria-label="Studio navigation">
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className={`studio-tabs__tab ${isActive(tab.to, tab.exact) ? "studio-tabs__tab--active" : ""}`}
          aria-current={isActive(tab.to, tab.exact) ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

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
  return (
    <IssuerGate>
      <div className="studio-layout">
        <StudioHeader />
        <StudioTabNav />
        <div className="studio-content__body">
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="schemas" element={<SchemasPage />} />
            <Route path="schemas/new" element={<CreateSchemaPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="issue" element={<IssuePage />} />
            <Route path="bulk-issue" element={<BulkIssuePage />} />
            <Route path="revoke" element={<RevokePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/studio" replace />} />
          </Routes>
        </div>
      </div>
    </IssuerGate>
  );
}

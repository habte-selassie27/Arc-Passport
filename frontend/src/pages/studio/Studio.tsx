import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useWallet } from "../../contexts/WalletContext";
import { useIssuerCheck } from "../../hooks/useIssuerCheck";
import { SchemaBuilder } from "../../components/studio/SchemaBuilder";
import { TemplateSelector } from "../../components/studio/TemplateSelector";
import { AnalyticsDashboard } from "../../components/studio/AnalyticsDashboard";
import { IssueDashboard } from "../../components/studio/IssueDashboard";
import { BulkIssue } from "../../components/studio/BulkIssue";
import { RevokeDashboard } from "../../components/studio/RevokeDashboard";
import { Settings } from "../../components/studio/Settings";
import { CredentialRequestList } from "../../components/forms/CredentialRequestList";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Callout } from "../../components/ui/Callout";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { AddressDisplay } from "../../components/ui/AddressDisplay";
import { API_BASE_URL } from "../../config/api";

const STUDIO_TABS = [
  { to: "/studio", label: "Overview", exact: true },
  { to: "/studio/issue", label: "Issue" },
  { to: "/studio/schemas", label: "Schemas" },
  { to: "/studio/templates", label: "Templates" },
  { to: "/studio/bulk", label: "Bulk Issue" },
  { to: "/studio/revoke", label: "Revoke" },
  { to: "/studio/settings", label: "Settings" },
];

function StudioNav() {
  const { pathname } = useLocation();
  return (
    <nav className="studio-tabs" role="tablist" aria-label="Issuer dashboard sections" style={{ marginBottom: "var(--space-6)" }}>
      {STUDIO_TABS.map(({ to, label, exact }) => {
        const active = exact ? pathname === to : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className="studio-tab"
            style={{ textDecoration: "none" }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Issuer role gating — shown before any Studio content */
function IssuerGate({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useWallet();
  const { isIssuer, isLoading, error, check } = useIssuerCheck(address);

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Dashboard"
          description="Issue attestations, manage schemas, revoke claims, and review credential requests. Requires ISSUER_ROLE on the AttestationRegistry."
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
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Dashboard"
          description="Verify your issuer permissions to access the dashboard."
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
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Issuer access"
          title="Verifying issuer permissions…"
          description="Check your wallet for a signature request."
        />
        <Card style={{ textAlign: "center" }}>
          <Spinner size={20} style={{ margin: "0 auto var(--space-4)", display: "block" }} aria-hidden="true" />
          <Button variant="ghost" disabled loading>
            Waiting for wallet…
          </Button>
        </Card>
      </div>
    );
  }

  if (error && isIssuer === null) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Dashboard"
          description="Issue attestations, manage schemas, revoke claims, and review credential requests."
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
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Dashboard"
          description="Issue attestations, manage schemas, revoke claims, and review credential requests."
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
            This address does not hold ISSUER_ROLE on the AttestationRegistry contract. If you
            should have issuer access, contact the contract admin to grant your wallet the role.
          </p>
          <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)" }}>
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

/** Overview tab — analytics + credential requests */
function OverviewTab() {
  const { address } = useWallet();
  return (
    <div className="space-y-6">
      <AnalyticsDashboard />
      {address && (
        <CredentialRequestList address={address} />
      )}
    </div>
  );
}

export function StudioPage() {
  const { address } = useWallet();

  return (
    <IssuerGate>
      <div className="animate-page" style={{ maxWidth: 960, margin: "0 auto" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader
            eyebrow="Issuer Dashboard"
            title="Issue & Manage Credentials"
            description={`Connected: ${address?.slice(0, 6)}...${address?.slice(-4) ?? ""}`}
            align="left"
          />
          <div className="flex gap-2">
            <a href={`${API_BASE_URL}/v1/docs`} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm">API Docs</Button>
            </a>
            <a href={`${API_BASE_URL}/v1/openapi.json`} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm">openapi.json</Button>
            </a>
          </div>
        </div>

        <div style={{ marginBottom: "var(--space-6)" }}>
        <Callout type="warn">
          <strong>ArcPass never asks you to approve token spending.</strong> Attestations are
          cryptographic commitments — not token transfers. If your wallet shows a token approval
          request (USDC <code className="mono t-xs">approve</code> or{" "}
          <code className="mono t-xs">setApprovalForAll</code>) on this site, reject it immediately.
        </Callout>
        </div>

        <StudioNav />

        <Routes>
          <Route index element={<OverviewTab />} />
          <Route path="issue" element={<IssueDashboard />} />
          <Route path="schemas" element={<SchemaBuilder />} />
          <Route path="templates" element={<TemplateSelector />} />
          <Route path="bulk" element={<BulkIssue />} />
          <Route path="revoke" element={<RevokeDashboard />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </div>
    </IssuerGate>
  );
}

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEASStats, useEASSchemas, useEASAttestations, useEASAttestation, useEASSchema, useEASVerify } from "../hooks/useEAS";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { CardSkeleton } from "../components/ui/Skeleton";
import { LogoMark } from "../components/ui/LogoMark";
import { AddressDisplay } from "../components/ui/AddressDisplay";
import { SERVICE_LABELS, type ServiceKey } from "../types/passport";
import type { EASAttestation, EASSchema } from "../hooks/useEAS";

function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isValidBytes32(id: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(id);
}

function truncateUID(uid: string): string {
  return `${uid.slice(0, 10)}...${uid.slice(-8)}`;
}

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    VALID:     { bg: "rgba(0,229,160,0.15)", fg: "#00E5A0" },
    REVOKED:   { bg: "rgba(239,68,68,0.15)", fg: "#EF4444" },
    EXPIRED:   { bg: "rgba(245,158,11,0.15)", fg: "#F59E0B" },
    UNKNOWN:   { bg: "rgba(156,163,175,0.15)", fg: "#9CA3AF" },
  };
  const c = colors[status] ?? colors.UNKNOWN;
  return (
    <span className="chip" style={{ background: c.bg, color: c.fg, fontSize: "0.7rem" }}>
      {status}
    </span>
  );
}

// ── Main EAS Page ──

export function EASPage() {
  const { uid: schemaUid, attestationUid, address: paramAddress } = useParams<{
    uid?: string;
    attestationUid?: string;
    address?: string;
  }>();

  if (schemaUid) return <SchemaDetailPage uid={schemaUid} />;
  if (attestationUid) return <AttestationDetailPage uid={attestationUid} />;
  if (paramAddress) return <VerifyPage address={paramAddress} />;

  return <EASExplorer />;
}

// ── EAS Explorer (main tabbed view) ──

function EASExplorer() {
  const [activeTab, setActiveTab] = useState<"overview" | "schemas" | "attestations">("overview");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Ethereum Attestation Service"
        title="EAS Explorer"
        description="Browse schemas, attestations, and verification status on ArcPass. Powered by composable on-chain attestations."
      />
      <div className="flex gap-2" style={{ marginBottom: "var(--space-6)" }}>
        {(["overview", "schemas", "attestations"] as const).map((tab) => (
          <button
            key={tab}
            className={`btn btn--${activeTab === tab ? "primary" : "ghost"} btn--sm`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "schemas" && <SchemasTab />}
      {activeTab === "attestations" && <AttestationsTab />}
    </div>
  );
}

// ── Overview Tab ──

function OverviewTab() {
  const { data: stats, isLoading, error, refetch } = useEASStats();

  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorBanner onRetry={() => void refetch()}>Failed to load EAS stats</ErrorBanner>;
  if (!stats) return null;

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      <StatCard label="Total Attestations" value={stats.total} color="var(--color-arc-primary)" />
      <StatCard label="Valid" value={stats.valid} color="var(--color-verified)" />
      <StatCard label="Revoked" value={stats.revoked} color="var(--color-danger)" />
      <StatCard label="Expired" value={stats.expired} color="var(--color-warning)" />
      <StatCard label="Unique Subjects" value={stats.uniqueSubjects} />
      <StatCard label="Unique Issuers" value={stats.uniqueIssuers} />
      <StatCard label="Unique Schemas" value={stats.uniqueSchemas} />
      <StatCard label="With Reference" value={stats.withReference} color="var(--color-arc-primary)" />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <p className="t-xs c-subtle">{label}</p>
      <p className="mono t-2xl" style={{ color: color ?? "var(--color-on-bright)", marginTop: "var(--space-1)" }}>
        {value}
      </p>
    </Card>
  );
}

// ── Schemas Tab ──

function SchemasTab() {
  const { data, isLoading, error, refetch } = useEASSchemas();
  const navigate = useNavigate();

  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorBanner onRetry={() => void refetch()}>Failed to load schemas</ErrorBanner>;
  if (!data || data.schemas.length === 0) {
    return <EmptyState title="No schemas" body="No attestation schemas registered yet." />;
  }

  return (
    <div className="grid gap-3">
      {data.schemas.map((schema) => (
        <Card key={schema.uid} style={{ cursor: "pointer" }} onClick={() => navigate(`/eas/schemas/${schema.uid}`)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="t-sm" style={{ fontWeight: 600 }}>{schema.name}</p>
              <p className="t-xs c-subtle" style={{ marginTop: 2 }}>{schema.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {schema.attestationCount !== undefined && (
                <span className="chip chip--muted">{schema.attestationCount} attestation{schema.attestationCount !== 1 ? "s" : ""}</span>
              )}
              <span className="t-xs c-subtle">{truncateUID(schema.uid)}</span>
            </div>
          </div>
          {schema.fields && (
            <p className="t-xs mono" style={{ marginTop: "var(--space-2)", color: "var(--color-subtle)" }}>
              Fields: {schema.fields}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Attestations Tab ──

function AttestationsTab() {
  const [filters, setFilters] = useState({
    subject: "",
    issuer: "",
    valid: "",
    page: 1,
  });

  const queryFilters = {
    ...(filters.subject && isValidAddress(filters.subject) ? { subject: filters.subject as `0x${string}` } : {}),
    ...(filters.issuer && isValidAddress(filters.issuer) ? { issuer: filters.issuer as `0x${string}` } : {}),
    ...(filters.valid ? { valid: filters.valid } : {}),
    page: filters.page,
    limit: 20,
  };

  const { data, isLoading, error, refetch } = useEASAttestations(queryFilters);
  const navigate = useNavigate();

  return (
    <div>
      {/* Filters */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
          <Input
            mono
            type="text"
            placeholder="Filter by subject (0x...)"
            value={filters.subject}
            onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value, page: 1 }))}
            aria-label="Filter by subject"
          />
          <Input
            mono
            type="text"
            placeholder="Filter by issuer (0x...)"
            value={filters.issuer}
            onChange={(e) => setFilters((f) => ({ ...f, issuer: e.target.value, page: 1 }))}
            aria-label="Filter by issuer"
          />
          <select
            value={filters.valid}
            onChange={(e) => setFilters((f) => ({ ...f, valid: e.target.value, page: 1 }))}
            className="select"
            style={{ minWidth: 120 }}
          >
            <option value="">All status</option>
            <option value="true">Valid only</option>
            <option value="false">Invalid/Revoked</option>
          </select>
        </div>
      </Card>

      {isLoading && <CardSkeleton />}
      {error && <ErrorBanner onRetry={() => void refetch()}>Failed to load attestations</ErrorBanner>}

      {!isLoading && !error && data && (
        <>
          <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-3)" }}>
            {data.total} attestation{data.total !== 1 ? "s" : ""} found
          </p>
          {data.attestations.length === 0 ? (
            <EmptyState title="No attestations" body="No attestations match your filters." />
          ) : (
            <div className="grid gap-3">
              {data.attestations.map((att) => (
                <AttestationRow key={att.claimId} attestation={att} onClick={() => navigate(`/eas/attestations/${att.claimId}`)} />
              ))}
            </div>
          )}
          {data.pages > 1 && (
            <div className="flex justify-between items-center" style={{ marginTop: "var(--space-4)" }}>
              <Button
                variant="ghost"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Previous
              </Button>
              <span className="t-xs c-subtle">Page {data.page} of {data.pages}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={data.page >= data.pages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AttestationRow({ attestation, onClick }: { attestation: EASAttestation; onClick: () => void }) {
  const now = Math.floor(Date.now() / 1000);
  let status = "VALID";
  if (attestation.revoked) status = "REVOKED";
  else if (attestation.expiresAt > 0 && attestation.expiresAt <= now) status = "EXPIRED";

  return (
    <Card style={{ cursor: "pointer" }} onClick={onClick}>
      <div className="flex items-center justify-between">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2">
            <StatusChip status={status} />
            <span className="mono t-xs">{truncateUID(attestation.claimId)}</span>
          </div>
          <div className="flex gap-4" style={{ marginTop: "var(--space-1)" }}>
            <span className="t-xs c-subtle">
              Subject: <span className="mono">{attestation.subject.slice(0, 8)}...{attestation.subject.slice(-4)}</span>
            </span>
            <span className="t-xs c-subtle">
              Issuer: <span className="mono">{attestation.issuer.slice(0, 8)}...{attestation.issuer.slice(-4)}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {attestation.refUID !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
            <span className="chip" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6", fontSize: "0.65rem" }}>
              Ref
            </span>
          )}
          <span className="t-xs c-subtle">{new Date(attestation.issuedAt * 1000).toLocaleDateString()}</span>
        </div>
      </div>
    </Card>
  );
}

// ── Schema Detail Page ──

function SchemaDetailPage({ uid }: { uid: string }) {
  const { data: schema, isLoading, error, refetch } = useEASSchema(uid);
  const navigate = useNavigate();

  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorBanner onRetry={() => void refetch()}>Schema not found</ErrorBanner>;
  if (!schema) return null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Schema"
        title={schema.name}
        description={schema.description || `Schema UID: ${truncateUID(uid)}`}
        align="left"
      />
      <Card>
        <div className="data-row">
          <span className="data-row__label">UID</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>{uid}</span>
        </div>
        <div className="data-row">
          <span className="data-row__label">Registry</span>
          <span className="t-sm">{schema.registry}</span>
        </div>
        {schema.version && (
          <div className="data-row">
            <span className="data-row__label">Version</span>
            <span className="t-sm">{schema.version}</span>
          </div>
        )}
        {schema.registrant && (
          <div className="data-row">
            <span className="data-row__label">Registrant</span>
            <AddressDisplay address={schema.registrant} />
          </div>
        )}
        {schema.registeredAt && (
          <div className="data-row">
            <span className="data-row__label">Registered</span>
            <span className="t-sm">{new Date(schema.registeredAt * 1000).toLocaleString()}</span>
          </div>
        )}
        {schema.fields && (
          <div className="data-row">
            <span className="data-row__label">Fields</span>
            <span className="mono t-xs" style={{ color: "var(--color-on-bright)" }}>{schema.fields}</span>
          </div>
        )}
        {schema.attestationCount !== undefined && (
          <div className="data-row">
            <span className="data-row__label">Attestations</span>
            <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>{schema.attestationCount}</span>
          </div>
        )}
      </Card>
      <div className="flex gap-3" style={{ marginTop: "var(--space-4)" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/eas")}>← Back to Explorer</Button>
      </div>
    </div>
  );
}

// ── Attestation Detail Page ──

function AttestationDetailPage({ uid }: { uid: string }) {
  const { data: att, isLoading, error, refetch } = useEASAttestation(uid);
  const navigate = useNavigate();

  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorBanner onRetry={() => void refetch()}>Attestation not found</ErrorBanner>;
  if (!att) return null;

  const status = att.status ?? "UNKNOWN";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Attestation"
        title={truncateUID(uid)}
        description={`On-chain attestation claim`}
        align="left"
      />
      <Card>
        <div className="flex items-center gap-3" style={{ marginBottom: "var(--space-4)" }}>
          <StatusChip status={status} />
          <span className="t-xs c-subtle">Created {new Date(att.issuedAt * 1000).toLocaleString()}</span>
        </div>
        <div className="data-row">
          <span className="data-row__label">UID</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)", wordBreak: "break-all" }}>{uid}</span>
        </div>
        <div className="data-row">
          <span className="data-row__label">Subject</span>
          <AddressDisplay address={att.subject} />
        </div>
        <div className="data-row">
          <span className="data-row__label">Issuer</span>
          <AddressDisplay address={att.issuer} />
        </div>
        <div className="data-row">
          <span className="data-row__label">Schema</span>
          <span
            className="mono t-xs"
            style={{ color: "var(--color-arc-primary)", cursor: "pointer" }}
            onClick={() => navigate(`/eas/schemas/${att.schemaId}`)}
          >
            {truncateUID(att.schemaId)}
          </span>
        </div>
        <div className="data-row">
          <span className="data-row__label">Data Commitment</span>
          <span className="mono t-xs" style={{ color: "var(--color-on-bright)", wordBreak: "break-all" }}>
            {att.dataCommitment}
          </span>
        </div>
        {att.expiresAt > 0 && (
          <div className="data-row">
            <span className="data-row__label">Expires</span>
            <span className="t-sm" style={{ color: att.expiresAt * 1000 < Date.now() ? "var(--color-warning)" : "var(--color-on-bright)" }}>
              {new Date(att.expiresAt * 1000).toLocaleString()}
            </span>
          </div>
        )}
        {att.revoked && att.revokedAt > 0 && (
          <div className="data-row">
            <span className="data-row__label">Revoked At</span>
            <span className="t-sm" style={{ color: "var(--color-danger)" }}>
              {new Date(att.revokedAt * 1000).toLocaleString()}
            </span>
          </div>
        )}
        {att.refUID !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
          <div className="data-row">
            <span className="data-row__label">References</span>
            <span
              className="mono t-xs"
              style={{ color: "var(--color-arc-primary)", cursor: "pointer" }}
              onClick={() => navigate(`/eas/attestations/${att.refUID}`)}
            >
              {truncateUID(att.refUID)}
            </span>
          </div>
        )}
      </Card>

      {/* Referenced attestation */}
      {att.referencedClaim && (
        <Card style={{ marginTop: "var(--space-4)" }}>
          <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Referenced Attestation</p>
          <AttestationRow
            attestation={att.referencedClaim}
            onClick={() => navigate(`/eas/attestations/${att.referencedClaim.claimId}`)}
          />
        </Card>
      )}

      {/* References (claims that point to this one) */}
      {att.references && att.references.length > 0 && (
        <Card style={{ marginTop: "var(--space-4)" }}>
          <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>
            Referenced By ({att.references.length})
          </p>
          <div className="grid gap-2">
            {att.references.map((ref: any) => (
              <div
                key={ref.claimId}
                className="flex items-center justify-between"
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface-1)",
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/eas/attestations/${ref.claimId}`)}
              >
                <span className="mono t-xs">{truncateUID(ref.claimId)}</span>
                <span className="t-xs c-subtle">{new Date(ref.issuedAt * 1000).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-3" style={{ marginTop: "var(--space-4)" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/eas")}>← Back to Explorer</Button>
        <a
          href={`https://testnet.arcscan.app/address/${att.issuer}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--ghost btn--sm"
        >
          Issuer on Explorer ↗
        </a>
      </div>
    </div>
  );
}

// ── Verify Page ──

function VerifyPage({ address }: { address: string }) {
  const { data: result, isLoading, error, refetch } = useEASVerify(address);

  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorBanner onRetry={() => void refetch()}>Verification failed</ErrorBanner>;
  if (!result) return null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Verification"
        title={`${address.slice(0, 6)}...${address.slice(-4)}`}
        description="EAS-style attestation verification status"
        align="left"
      />
      <Card>
        <div className="grid grid-cols-3 gap-4" style={{ marginBottom: "var(--space-4)" }}>
          <div style={{ textAlign: "center" }}>
            <p className="mono t-2xl" style={{ color: "var(--color-verified)" }}>{result.validCount}</p>
            <p className="t-xs c-subtle">Valid</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <p className="mono t-2xl" style={{ color: "var(--color-danger)" }}>{result.revokedCount}</p>
            <p className="t-xs c-subtle">Revoked</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <p className="mono t-2xl" style={{ color: "var(--color-warning)" }}>{result.expiredCount}</p>
            <p className="t-xs c-subtle">Expired</p>
          </div>
        </div>
        <div className="data-row">
          <span className="data-row__label">Total Attestations</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>{result.attestationCount}</span>
        </div>
        <div className="data-row">
          <span className="data-row__label">Unique Issuers</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>{result.uniqueIssuers}</span>
        </div>
        <div className="data-row">
          <span className="data-row__label">Unique Schemas</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>{result.uniqueSchemas}</span>
        </div>
        {result.onChainVerification && (
          <>
            <div className="data-row">
              <span className="data-row__label">Humanity Score</span>
              <span className="mono t-sm" style={{ color: "var(--color-arc-primary)" }}>
                {(result.onChainVerification.score / 10).toFixed(1)}
              </span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Is Human</span>
              <span className="t-sm" style={{ color: result.onChainVerification.isHuman ? "var(--color-verified)" : "var(--color-warning)" }}>
                {result.onChainVerification.isHuman ? "Yes" : "No"}
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

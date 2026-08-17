import { Routes, Route, Link, useLocation } from "react-router-dom";
import { SchemaBuilder } from "../../components/studio/SchemaBuilder";
import { TemplateSelector } from "../../components/studio/TemplateSelector";
import { AnalyticsDashboard } from "../../components/studio/AnalyticsDashboard";
import { IssueDashboard } from "../../components/studio/IssueDashboard";
import { BulkIssue } from "../../components/studio/BulkIssue";
import { RevokeDashboard } from "../../components/studio/RevokeDashboard";
import { Settings } from "../../components/studio/Settings";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { API_BASE_URL } from "../../config/api";

const STUDIO_LINKS = [
  { to: "/studio", label: "Overview", exact: true },
  { to: "/studio/schemas", label: "Schemas" },
  { to: "/studio/templates", label: "Templates" },
  { to: "/studio/issue", label: "Issue" },
  { to: "/studio/bulk", label: "Bulk Issue" },
  { to: "/studio/revoke", label: "Revoke" },
  { to: "/studio/analytics", label: "Analytics" },
  { to: "/studio/settings", label: "Settings" },
];

function StudioNav() {
  const { pathname } = useLocation();
  return (
    <nav className="studio-tabs" role="tablist" aria-label="Studio sections" style={{ marginBottom: "var(--space-6)" }}>
      {STUDIO_LINKS.map(({ to, label, exact }) => {
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

export function StudioPage() {
  return (
    <div className="animate-page" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          eyebrow="ArcPass Studio"
          title="Issuer Studio"
          description="Manage schemas, issue attestations, and monitor analytics across all 9 service verticals."
          align="left"
        />
        <div className="flex gap-2">
          <a href={`${API_BASE_URL}/v1/docs`} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm">API Docs (Swagger)</Button>
          </a>
          <a href={`${API_BASE_URL}/v1/openapi.json`} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm">openapi.json</Button>
          </a>
        </div>
      </div>

      <StudioNav />

      <Routes>
        <Route index element={<AnalyticsDashboard />} />
        <Route path="schemas" element={<SchemaBuilder />} />
        <Route path="templates" element={<TemplateSelector />} />
        <Route path="issue" element={<IssueDashboard />} />
        <Route path="bulk" element={<BulkIssue />} />
        <Route path="revoke" element={<RevokeDashboard />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </div>
  );
}

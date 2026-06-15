import { Routes, Route, Link, useLocation } from "react-router-dom";
import { SchemaBuilder } from "../../components/studio/SchemaBuilder";
import { TemplateSelector } from "../../components/studio/TemplateSelector";
import { AnalyticsDashboard } from "../../components/studio/AnalyticsDashboard";
import { IssueDashboard } from "../../components/studio/IssueDashboard";
import { BulkIssue } from "../../components/studio/BulkIssue";
import { RevokeDashboard } from "../../components/studio/RevokeDashboard";
import { Settings } from "../../components/studio/Settings";
import { API_BASE_URL } from "../../config/api";

const STUDIO_LINKS = [
  { to: "/studio",              label: "Overview",  exact: true },
  { to: "/studio/schemas",      label: "Schemas"    },
  { to: "/studio/templates",    label: "Templates"  },
  { to: "/studio/issue",        label: "Issue"      },
  { to: "/studio/bulk",         label: "Bulk Issue" },
  { to: "/studio/revoke",       label: "Revoke"     },
  { to: "/studio/analytics",    label: "Analytics"  },
  { to: "/studio/settings",     label: "Settings"   },
];

function StudioNav() {
  const { pathname } = useLocation();
  return (
    <nav className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2 overflow-x-auto">
      {STUDIO_LINKS.map(({ to, label, exact }) => (
        <Link
          key={to}
          to={to}
          className={`text-xs whitespace-nowrap px-3 py-2 rounded-t-lg border-b-2 -mb-[2px] transition-colors ${
            (exact ? pathname === to : pathname.startsWith(to))
              ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 font-semibold"
              : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function StudioPage() {
  return (
    <div className="py-12 px-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ArcPass Studio</h1>
        <div className="flex items-center gap-3 text-xs">
          <a
            href={`${API_BASE_URL}/v1/docs`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium"
          >
            API Docs (Swagger)
          </a>
          <a
            href={`${API_BASE_URL}/v1/openapi.json`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium"
          >
            openapi.json
          </a>
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Issuer dashboard for managing schemas, issuing attestations, and monitoring analytics across all 9 service verticals.
      </p>
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

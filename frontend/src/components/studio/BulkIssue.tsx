import { useMemo, useState } from "react";
import { apiUrl } from "../../config/api";

type ServiceKey = "identity" | "kyc" | "credentials" | "dao" | "reputation" | "employment" | "education" | "social" | "custom";

const SERVICE_OPTIONS: { key: ServiceKey; label: string; description: string; csvHeader: string }[] = [
  { key: "identity",    label: "Identity",    description: "Display name + avatar (BASIC_IDENTITY)",       csvHeader: "subject,displayName,avatarCid,expiresAt" },
  { key: "kyc",         label: "KYC",         description: "KYC level 0-3 + ISO country + provider",     csvHeader: "subject,level,country,provider,expiresAt" },
  { key: "credentials", label: "Credentials", description: "Certification name + issuing body + cert ID", csvHeader: "subject,certName,issuingBody,certId,validUntil" },
  { key: "dao",         label: "DAO",         description: "DAO name + role + voting weight",            csvHeader: "subject,daoName,daoAddress,role,votingWeight" },
  { key: "reputation",  label: "Reputation",  description: "Score (uint256) + domain + data points",     csvHeader: "subject,score,domain,dataPoints,expiresAt" },
  { key: "employment",  label: "Employment",  description: "Employer + role + start/end dates",          csvHeader: "subject,employer,role,startDate,endDate" },
  { key: "education",   label: "Education",   description: "Institution + degree + graduation year",     csvHeader: "subject,institution,degree,fieldOfStudy,graduationYear" },
  { key: "social",      label: "Social",      description: "Platform + handle + profile ID",             csvHeader: "subject,platform,handle,profileId,expiresAt" },
];

interface BulkResult {
  index:    number;
  success:  boolean;
  txHash?:  string;
  error?:   string;
  message?: string;
}

interface BulkResponse {
  service:   ServiceKey;
  mode:      "batch" | "perItem";
  total:     number;
  succeeded: number;
  failed:    number;
  results:   BulkResult[];
  errors:    { row: number; field?: string; error: string }[];
}

function parsePreview(csv: string): { headers: string[]; rows: string[][]; errors: string[] } {
  const errors: string[] = [];
  if (!csv.trim()) return { headers: [], rows: [], errors };
  const lines = csv.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [], errors };
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
        if (c === '"') { inQ = false; continue; }
        cur += c; continue;
      }
      if (c === '"') { inQ = true; continue; }
      if (c === ",") { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = split(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((l, i) => {
    const cells = split(l);
    if (cells.length !== headers.length) {
      errors.push(`Row ${i + 2}: expected ${headers.length} columns, got ${cells.length}`);
    }
    return cells;
  });
  return { headers, rows, errors };
}

export function BulkIssue() {
  const [service, setService]   = useState<ServiceKey>("identity");
  const [csv, setCsv]           = useState("");
  const [mode, setMode]         = useState<"batch" | "perItem">("perItem");
  const [submitting, setSubmit] = useState(false);
  const [response, setResponse] = useState<BulkResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const selected = SERVICE_OPTIONS.find((s) => s.key === service)!;
  const preview  = useMemo(() => parsePreview(csv), [csv]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const submit = async () => {
    setSubmit(true); setError(null); setResponse(null);
    try {
      const res = await fetch(apiUrl("/v1/bulk/csv"), {
        method:  "POST",
        headers: {
          "Content-Type":     "application/json",
          "x-wallet-address": "",
          "x-signature":      "",
          "x-nonce":          String(Date.now()),
        },
        body: JSON.stringify({ service, csv, mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data?.error?.message ?? `Request failed: ${res.status}`);
        return;
      }
      setResponse(data.data as BulkResponse);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmit(false);
    }
  };

  const downloadTemplate = () => {
    const sample = selected.key === "kyc"
      ? "subject,level,country,provider,expiresAt\n0x0000000000000000000000000000000000000001,1,US,self,1893456000\n0x0000000000000000000000000000000000000002,2,GB,jumio,1893456000"
      : selected.key === "credentials"
        ? "subject,certName,issuingBody,certId,validUntil\n0x0000000000000000000000000000000000000001,AWS Solutions Architect,Amazon,AWS-12345,1893456000"
        : selected.key === "education"
          ? "subject,institution,degree,fieldOfStudy,graduationYear\n0x0000000000000000000000000000000000000001,MIT,BS,Computer Science,2024"
          : `subject,...\n0x0000000000000000000000000000000000000001,...`;
    const blob = new Blob([sample], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${selected.key}-template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Issue</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            CSV-driven batch attestation. Up to 100 rows per request. Per-item try/catch — one failure does not abort the batch.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Download template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Service</label>
          <select
            value={service}
            onChange={(e) => { setService(e.target.value as ServiceKey); setResponse(null); }}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          >
            {SERVICE_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label} — {s.description}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mode</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("perItem")}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium border ${mode === "perItem" ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"}`}
            >
              Per-item (row-level errors)
            </button>
            <button
              type="button"
              onClick={() => setMode("batch")}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium border ${mode === "batch" ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"}`}
            >
              Batch (single tx)
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">CSV</label>
          <label className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
            Upload .csv file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 mb-1">Header: {selected.csvHeader}</div>
        <textarea
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setResponse(null); }}
          placeholder={`${selected.csvHeader}\n0x0000000000000000000000000000000000000001,...`}
          rows={10}
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono"
        />
        {preview.errors.length > 0 && (
          <ul className="mt-2 text-xs text-amber-600 dark:text-amber-400 list-disc list-inside">
            {preview.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
            {preview.errors.length > 5 && <li>… and {preview.errors.length - 5} more</li>}
          </ul>
        )}
      </div>

      {preview.rows.length > 0 && (
        <div className="rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 bg-gray-50 dark:bg-gray-900">
            Preview: {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"}
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-2 py-1 text-left">#</th>
                {preview.headers.map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 50).map((cells, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-2 py-1 text-gray-500">{i + 2}</td>
                  {preview.headers.map((_h, j) => (
                    <td key={j} className="px-2 py-1 font-mono whitespace-nowrap">{cells[j] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {preview.rows.length > 50 && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400 px-3 py-1">… and {preview.rows.length - 50} more</div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {response && (
        <div className="rounded border border-gray-200 dark:border-gray-700 p-3 space-y-2">
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">total: {response.total}</span>
            <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200">succeeded: {response.succeeded}</span>
            <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200">failed: {response.failed}</span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">mode: {response.mode}</span>
          </div>
          {response.errors.length > 0 && (
            <div className="text-xs text-amber-700 dark:text-amber-300">
              Validation errors: {response.errors.map((e) => `row ${e.row} (${e.error})`).join("; ")}
            </div>
          )}
          {response.results.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Status</th>
                    <th className="px-2 py-1 text-left">txHash / error</th>
                  </tr>
                </thead>
                <tbody>
                  {response.results.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-2 py-1">{r.index + 2}</td>
                      <td className="px-2 py-1">
                        {r.success
                          ? <span className="text-green-600 dark:text-green-400">✓</span>
                          : <span className="text-red-600 dark:text-red-400">✗ {r.error}</span>}
                      </td>
                      <td className="px-2 py-1 font-mono break-all">
                        {r.success
                          ? <a href={`https://testnet.arcscan.app/tx/${r.txHash}`} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{r.txHash}</a>
                          : r.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} ready · max 100
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || preview.rows.length === 0}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium text-sm transition-colors"
        >
          {submitting ? "Submitting…" : `Submit ${preview.rows.length} row${preview.rows.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}

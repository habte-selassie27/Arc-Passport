import { useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { apiUrl } from "../../config/api";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";

type ServiceKey = "identity" | "kyc" | "credentials" | "dao" | "reputation" | "employment" | "education" | "social" | "custom";

const SERVICE_OPTIONS: { key: ServiceKey; label: string; description: string; csvHeader: string }[] = [
  { key: "identity", label: "Identity", description: "Display name + avatar (BASIC_IDENTITY)", csvHeader: "subject,displayName,avatarCid,expiresAt" },
  { key: "kyc", label: "KYC", description: "KYC level 0-3 + ISO country + provider", csvHeader: "subject,level,country,provider,expiresAt" },
  { key: "credentials", label: "Credentials", description: "Certification name + issuing body + cert ID", csvHeader: "subject,certName,issuingBody,certId,validUntil" },
  { key: "dao", label: "DAO", description: "DAO name + role + voting weight", csvHeader: "subject,daoName,daoAddress,role,votingWeight" },
  { key: "reputation", label: "Reputation", description: "Score (uint256) + domain + data points", csvHeader: "subject,score,domain,dataPoints,expiresAt" },
  { key: "employment", label: "Employment", description: "Employer + role + start/end dates", csvHeader: "subject,employer,role,startDate,endDate" },
  { key: "education", label: "Education", description: "Institution + degree + graduation year", csvHeader: "subject,institution,degree,fieldOfStudy,graduationYear" },
  { key: "social", label: "Social", description: "Platform + handle + profile ID", csvHeader: "subject,platform,handle,profileId,expiresAt" },
];

interface BulkResult {
  index: number;
  success: boolean;
  txHash?: string;
  error?: string;
  message?: string;
}

interface BulkResponse {
  service: ServiceKey;
  mode: "batch" | "perItem";
  total: number;
  succeeded: number;
  failed: number;
  results: BulkResult[];
  errors: { row: number; field?: string; error: string }[];
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
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [service, setService] = useState<ServiceKey>("identity");
  const [csv, setCsv] = useState("");
  const [mode, setMode] = useState<"batch" | "perItem">("perItem");
  const [submitting, setSubmit] = useState(false);
  const [response, setResponse] = useState<BulkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = SERVICE_OPTIONS.find((s) => s.key === service)!;
  const preview = useMemo(() => parsePreview(csv), [csv]);
  const rowCount = preview.rows.length;
  const pct = Math.min((rowCount / 100) * 100, 100);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const submit = async () => {
    if (!address) { setError("Connect your wallet first"); return; }
    setSubmit(true); setError(null); setResponse(null);
    try {
      const nonce = String(Date.now());
      const message = `ArcPass bulk:POST /v1/bulk/csv:${nonce}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch(apiUrl("/v1/bulk/csv"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address,
          "x-signature": signature,
          "x-nonce": nonce,
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${selected.key}-template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
        <div>
          <h3 className="display--medium t-lg" style={{ marginBottom: "var(--space-1)" }}>Bulk Issue</h3>
          <p className="t-xs c-muted">
            CSV-driven batch attestation. Up to 100 rows per request. Per-item try/catch — one failure does not abort the batch.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          Download template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: "var(--space-4)" }}>
        <Field label="Service" htmlFor="bulk-service">
          <Select
            id="bulk-service"
            value={service}
            onChange={(e) => { setService(e.target.value as ServiceKey); setResponse(null); }}
          >
            {SERVICE_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label} — {s.description}</option>
            ))}
          </Select>
        </Field>

        <div className="field">
          <label className="field__label">Mode</label>
          <SegmentedControl
            options={[
              { value: "perItem" as const, label: "Per-item (row-level errors)" },
              { value: "batch" as const, label: "Batch (single tx)" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>
      </div>

      <div className="field" style={{ marginBottom: "var(--space-4)" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-1)" }}>
          <label className="field__label">CSV</label>
          <label className="file-label">
            Upload .csv file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <p className="mono t-xs c-subtle" style={{ marginBottom: "var(--space-1)" }}>
          Header: {selected.csvHeader}
        </p>
        <textarea
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setResponse(null); }}
          placeholder={`${selected.csvHeader}\n0x0000000000000000000000000000000000000001,...`}
          rows={10}
          className="input input--mono"
          style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", lineHeight: 1.6 }}
        />
        {preview.errors.length > 0 && (
          <ul className="t-xs c-warn" style={{ marginTop: "var(--space-2)", listStyle: "disc", paddingLeft: "var(--space-5)" }}>
            {preview.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
            {preview.errors.length > 5 && <li>… and {preview.errors.length - 5} more</li>}
          </ul>
        )}
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-3" style={{ marginBottom: "var(--space-4)" }}>
        <div className="progress">
          <div className="progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="mono t-xs c-subtle" style={{ flexShrink: 0 }}>
          {rowCount} / 100 rows
        </span>
      </div>

      {error && (
        <div className="sim-box--failed sim-box" role="alert" style={{ marginBottom: "var(--space-4)" }}>
          <p className="sim-box__row"><span className="sim-box__fail" aria-hidden="true">✗</span> {error}</p>
        </div>
      )}

      {response && (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <div className="flex flex-wrap gap-3 t-xs" style={{ marginBottom: "var(--space-3)" }}>
            <span className="chip chip--pending">total: {response.total}</span>
            <span className="chip chip--valid">succeeded: {response.succeeded}</span>
            <span className="chip chip--revoked">failed: {response.failed}</span>
            <span className="chip chip--muted">mode: {response.mode}</span>
          </div>
          {response.errors.length > 0 && (
            <p className="t-xs c-warn" style={{ marginBottom: "var(--space-3)" }}>
              Validation errors: {response.errors.map((e) => `row ${e.row} (${e.error})`).join("; ")}
            </p>
          )}
          {response.results.length > 0 && (
            <div style={{ maxHeight: 256, overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
              <table className="table">
                <thead>
                  <tr><th>#</th><th>Status</th><th>txHash / error</th></tr>
                </thead>
                <tbody>
                  {response.results.map((r, i) => (
                    <tr key={i}>
                      <td className="c-subtle">{r.index + 2}</td>
                      <td>
                        {r.success
                          ? <span className="c-verified">✓</span>
                          : <span className="c-danger">✗ {r.error}</span>}
                      </td>
                      <td className="mono" style={{ fontSize: "var(--text-xs)" }}>
                        {r.success
                          ? <a href={`https://testnet.arcscan.app/tx/${r.txHash}`} target="_blank" rel="noreferrer" className="c-primary">{r.txHash}</a>
                          : r.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <div className="flex items-center justify-between">
        <span className="mono t-xs c-subtle">
          {rowCount} row{rowCount === 1 ? "" : "s"} ready · max 100
        </span>
        <Button
          variant="primary"
          disabled={submitting || rowCount === 0 || !address}
          loading={submitting}
          onClick={submit}
        >
          {!address ? "Connect wallet" : submitting ? "Submitting…" : `Submit ${rowCount} row${rowCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </Card>
  );
}

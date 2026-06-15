import { useState } from "react";
import { useSignMessage } from "wagmi";
import { ServiceSelector } from "./ServiceSelector";
import { useWallet } from "../../contexts/WalletContext";
import { apiUrl } from "../../config/api";
import { TxStatus } from "../shared/TxStatus";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";
import type { ServiceKey } from "../../types/passport";

const ENDPOINTS: Record<ServiceKey, { path: string; fields: { name: string; type: string; label: string }[] }> = {
  identity:    { path: "/v1/identity/register",   fields: [{ name: "displayName", type: "string", label: "Display Name" }, { name: "avatarCid", type: "string", label: "Avatar CID (IPFS)" }] },
  kyc:         { path: "/v1/kyc/issue",          fields: [{ name: "level", type: "number", label: "KYC Level (1-3)" }, { name: "country", type: "string", label: "Country (ISO)" }, { name: "provider", type: "string", label: "KYC Provider" }] },
  credentials: { path: "/v1/credentials/certify",fields: [{ name: "certName", type: "string", label: "Certification Name" }, { name: "issuingBody", type: "string", label: "Issuing Body" }] },
  dao:         { path: "/v1/dao/enroll",         fields: [{ name: "daoName", type: "string", label: "DAO Name" }, { name: "daoAddress", type: "address", label: "DAO Address" }, { name: "role", type: "string", label: "Role" }] },
  reputation:  { path: "/v1/reputation/record",  fields: [{ name: "score", type: "number", label: "Score (0-10000)" }, { name: "domain", type: "string", label: "Domain" }] },
  employment:  { path: "/v1/employment/issue",   fields: [{ name: "employer", type: "string", label: "Employer" }, { name: "role", type: "string", label: "Role" }, { name: "startDate", type: "number", label: "Start (unix)" }] },
  education:   { path: "/v1/education/degree",   fields: [{ name: "institution", type: "string", label: "Institution" }, { name: "degree", type: "string", label: "Degree" }, { name: "graduationYear", type: "number", label: "Year" }] },
  social:      { path: "/v1/social/link",        fields: [{ name: "platform", type: "string", label: "Platform" }, { name: "handle", type: "string", label: "Handle" }] },
  custom:      { path: "/v1/custom/attest",      fields: [{ name: "schemaId", type: "bytes32", label: "Schema ID" }, { name: "data", type: "string", label: "Encoded Data" }] },
};

export function IssueDashboard() {
  const { address } = useWallet();
  const { signMessageAsync } = useSignMessage();
  const [service, setService] = useState<ServiceKey>("kyc");
  const [subject, setSubject] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ txHash?: string; claimId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ep = ENDPOINTS[service];

  const handleIssue = async () => {
    if (!address) {
      toast("error", "Connect your wallet first");
      return;
    }
    if (!subject) {
      toast("error", "Subject address is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const nonce = crypto.randomUUID();
      const path = ep.path;
      const message = `ArcPass:${path}:${nonce}`;
      const signature = await signMessageAsync({ message });

      const body: Record<string, unknown> = { subject };
      for (const f of ep.fields) {
        body[f.name] = values[f.name] ?? "";
      }

      const res = await fetch(apiUrl(path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address,
          "x-nonce": nonce,
          "x-signature": signature,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? `${res.status} ${res.statusText}`);
      setResult(json.data);
      toast("success", `${service} credential issued`);
    } catch (err: unknown) {
      const msg = parseContractError(err);
      setError(msg);
      toast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Issue Credential</h3>

      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Service</label>
        <ServiceSelector value={service} onChange={setService} />
      </div>

      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Subject address</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="0x..."
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Schema fields</label>
        <div className="space-y-2">
          {ep.fields.map((f) => (
            <div key={f.name}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{f.label}</p>
              <input
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                placeholder={f.label}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {result && (
        <div className="rounded border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-xs space-y-1">
          <p className="text-green-700 dark:text-green-300 font-medium">Issued successfully</p>
          {result.txHash && <p className="text-gray-600 dark:text-gray-400 font-mono">tx: {result.txHash.slice(0, 20)}...</p>}
          {result.claimId && <p className="text-gray-600 dark:text-gray-400 font-mono">claim: {result.claimId.slice(0, 20)}...</p>}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>POST <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">{ep.path}</code></span>
        <button
          onClick={handleIssue}
          disabled={submitting || !address}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium text-sm transition-colors"
        >
          {submitting ? "Issuing..." : "Issue"}
        </button>
      </div>
    </div>
  );
}

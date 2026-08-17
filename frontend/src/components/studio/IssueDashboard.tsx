import { useState, useEffect } from "react";
import { useSignMessage } from "wagmi";
import { ServiceSelector } from "./ServiceSelector";
import { useWallet } from "../../contexts/WalletContext";
import { apiUrl } from "../../config/api";
import { TxStatus } from "../shared/TxStatus";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import type { ServiceKey } from "../../types/passport";

interface SchemaField {
  name: string;
  type: string;
}

interface SchemaOption {
  key: string;
  name: string;
  version: string;
  id: string;
  fields: SchemaField[];
}

export function IssueDashboard() {
  const { address } = useWallet();
  const { signMessageAsync } = useSignMessage();
  const [service, setService] = useState<ServiceKey>("kyc");
  const [schemas, setSchemas] = useState<SchemaOption[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<SchemaOption | null>(null);
  const [subject, setSubject] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ txHash?: string; schemaId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSchemas([]);
    setSelectedSchema(null);
    setValues({});
    fetch(apiUrl(`/v1/${service}/schemas`))
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setSchemas(json.data.schemas);
          if (json.data.schemas.length > 0) setSelectedSchema(json.data.schemas[0]);
        }
      })
      .catch(() => {});
  }, [service]);

  const handleIssue = async () => {
    if (!address) {
      toast("error", "Connect your wallet first");
      return;
    }
    if (!subject) {
      toast("error", "Subject address is required");
      return;
    }
    if (!selectedSchema) {
      toast("error", "Select a schema");
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const nonce = crypto.randomUUID();
      const path = `/v1/${service}/issue`;
      const message = `ArcPass:${path}:${nonce}`;
      const signature = await signMessageAsync({ message });

      const body = {
        subject,
        schema: selectedSchema.name,
        fields: values,
        expiresAt: 0,
      };

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
    <Card>
      <h3 className="display--medium t-lg" style={{ marginBottom: "var(--space-4)" }}>Issue Credential</h3>

      <div className="space-y-4">
        <div className="field">
          <label className="field__label">Service</label>
          <ServiceSelector value={service} onChange={setService} />
        </div>

        {schemas.length > 0 && (
          <Field label="Schema" htmlFor="issue-schema">
            <Select
              id="issue-schema"
              value={selectedSchema?.key ?? ""}
              onChange={(e) => {
                const s = schemas.find((s) => s.key === e.target.value);
                setSelectedSchema(s ?? null);
                setValues({});
              }}
            >
              {schemas.map((s) => (
                <option key={s.key} value={s.key}>{s.name} v{s.version}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Subject address" htmlFor="issue-subject" helper="Wallet address receiving the credential.">
          <Input
            id="issue-subject"
            mono
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="0x..."
          />
        </Field>

        {selectedSchema && (
          <div className="field">
            <label className="field__label">Schema fields</label>
            <div className="space-y-2">
              {selectedSchema.fields.map((f) => (
                <div key={f.name} className="flex gap-2 items-end">
                  <Field label={`${f.name} (${f.type})`} htmlFor={`field-${f.name}`} style={{ flex: 1, marginBottom: 0 }}>
                    <Input
                      id={`field-${f.name}`}
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      placeholder={f.type}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="sim-box" style={{ background: "var(--color-verified-bg)", borderColor: "rgba(0,229,160,0.2)" }}>
            <p className="sim-box__row"><span className="sim-box__check" aria-hidden="true">✓</span> Issued successfully</p>
            {result.txHash && (
              <p className="sim-box__row"><span className="sim-box__check" aria-hidden="true">✓</span> tx: <code className="mono">{result.txHash.slice(0, 20)}...</code></p>
            )}
            {result.schemaId && (
              <p className="sim-box__row"><span className="sim-box__check" aria-hidden="true">✓</span> schema: <code className="mono">{result.schemaId.slice(0, 20)}...</code></p>
            )}
          </div>
        )}

        {error && (
          <div className="sim-box--failed sim-box" role="alert">
            <p className="sim-box__row"><span className="sim-box__fail" aria-hidden="true">✗</span> {error}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between" style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
        <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--color-surface-0)", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "4px 10px" }}>
          <span style={{ color: "var(--color-verified)" }}>POST</span> /v1/{service}/issue
        </span>
        <Button
          variant="primary"
          disabled={submitting || !address}
          loading={submitting}
          onClick={handleIssue}
        >
          Issue
        </Button>
      </div>
    </Card>
  );
}

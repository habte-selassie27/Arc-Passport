import { useState, useCallback, useMemo, useRef } from "react";
import { useWriteContract } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { ADDRESSES } from "../../config/addresses";
import { SCHEMA_REGISTRY_ABI } from "../../abis/SchemaRegistry";
import { TxStatus } from "../shared/TxStatus";
import { TransactionPreview } from "../shared/TransactionPreview";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { CodeBlock } from "../ui/CodeBlock";

interface SchemaField {
  name: string;
  type: string;
}

const SOLIDITY_TYPES = ["string", "uint8", "uint16", "uint256", "address", "bool", "bytes32", "int256"];

function emptyField(): SchemaField {
  return { name: "", type: "string" };
}

export function SchemaForm() {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("3.0.0");
  const [fields, setFields] = useState<SchemaField[]>([
    { name: "level", type: "uint8" },
    { name: "country", type: "string" },
  ]);

  const fieldsJson = JSON.stringify(fields.map((f) => ({ name: f.name, type: f.type })), null, 2);
  const regArgs = [name, version, fieldsJson] as const;
  const simEnabled = !!name && !!version && fields.length > 0 && fields.every((f) => f.name && f.type) && !!ADDRESSES.schemaRegistry;

  const computedSchemaId = useMemo(() => {
    const compact = JSON.stringify(fields.map((f) => ({ name: f.name, type: f.type })));
    if (!name || !version || !compact) return null;
    return keccak256(encodePacked(["string", "string", "string"], [name, version, compact]));
  }, [name, version, fields]);

  const simRequestRef = useRef<unknown | null>(null);

  const handleSimResult = useCallback((result: { request: unknown | null; error: string | null }) => {
    simRequestRef.current = result.request;
  }, []);

  const { writeContract, data: hash, isPending, error } = useWriteContract({
    mutation: {
      onError: (err) => toast("error", parseContractError(err)),
      onSuccess: () => toast("success", "Schema registered"),
    },
  });

  const addField = useCallback(() => {
    setFields((prev) => [...prev, emptyField()]);
  }, []);

  const removeField = useCallback((i: number) => {
    setFields((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }, []);

  const updateField = useCallback((i: number, key: "name" | "type", value: string) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [key]: value } : f)));
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!ADDRESSES.schemaRegistry) {
      toast("error", "SchemaRegistry not configured");
      return;
    }
    const invalid = fields.find((f) => !f.name || !f.type);
    if (invalid) {
      toast("error", "All fields must have a name and type");
      return;
    }
    if (!simRequestRef.current) {
      toast("error", "Transaction simulation did not succeed. Check schema parameters.");
      return;
    }
    writeContract(simRequestRef.current as Parameters<typeof writeContract>[0]);
  }, [writeContract, fields]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Schema Name" htmlFor="schema-name" helper="Use snake_case. e.g. kyc_basic, employment_record">
        <Input
          id="schema-name"
          mono
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="kyc_basic"
          required
        />
      </Field>

      <Field label="Version" htmlFor="schema-version">
        <Input
          id="schema-version"
          mono
          type="text"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="1.0.0"
          required
        />
      </Field>

      <div className="field">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label className="field__label">Fields</label>
          <button type="button" className="btn btn--ghost btn--sm" onClick={addField}>
            + Add field
          </button>
        </div>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                mono
                type="text"
                value={field.name}
                onChange={(e) => updateField(i, "name", e.target.value)}
                placeholder="field_name"
                aria-label={`Field ${i + 1} name`}
              />
              <Select
                mono
                value={field.type}
                onChange={(e) => updateField(i, "type", e.target.value)}
                aria-label={`Field ${i + 1} type`}
                style={{ width: 130, flexShrink: 0 }}
              >
                {SOLIDITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => removeField(i)}
                disabled={fields.length <= 1}
                className="btn btn--ghost btn--sm"
                style={{ color: "var(--color-subtle)", flexShrink: 0 }}
                title="Remove field"
                aria-label={`Remove field ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {computedSchemaId && (
        <div className="field">
          <label className="field__label" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>
            Schema ID (computed live)
          </label>
          <div className="flex items-center gap-2">
            <code
              className="mono"
              style={{
                flex: 1,
                fontSize: "var(--text-xs)",
                color: "var(--color-muted)",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {computedSchemaId}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(computedSchemaId);
                toast("success", "Schema ID copied");
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      )}

      <details style={{ fontSize: "var(--text-sm)" }}>
        <summary className="c-muted" style={{ cursor: "pointer" }}>
          ▶ Preview JSON
        </summary>
        <CodeBlock style={{ marginTop: "var(--space-2)" }}>
          <span className="t-comment">// schema_id: {computedSchemaId?.slice(0, 10)}...{computedSchemaId?.slice(-6) ?? "—"}</span>
          {"\n"}
          {fieldsJson}
        </CodeBlock>
      </details>

      <TransactionPreview
        enabled={simEnabled}
        address={ADDRESSES.schemaRegistry}
        abi={SCHEMA_REGISTRY_ABI}
        functionName="registerSchema"
        args={regArgs}
        label="Schema Registration"
        onSimResult={handleSimResult}
      />

      <Button type="submit" block disabled={isPending || !simEnabled} loading={isPending}>
        Register Schema onchain
      </Button>

      <TxStatus hash={hash} />
      {error && <p className="c-danger t-sm text-center">{parseContractError(error)}</p>}
    </form>
  );
}

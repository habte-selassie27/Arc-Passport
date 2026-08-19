import { useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { ADDRESSES } from "../../config/addresses";
import { SCHEMA_REGISTRY_ABI } from "../../abis/SchemaRegistry";
import { FieldBuilder, type FieldDef } from "./FieldBuilder";
import { TxStatus } from "../shared/TxStatus";
import { TransactionPreview } from "../shared/TransactionPreview";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { CodeBlock } from "../ui/CodeBlock";

interface PrefillState {
  prefill?: {
    name: string;
    version: string;
    fields: FieldDef[];
  };
}

function getInitialFields(state: PrefillState): FieldDef[] {
  if (state.prefill?.fields?.length) {
    return state.prefill.fields.map((f) => ({ name: f.name, type: f.type }));
  }
  return [{ name: "", type: "string" }];
}

export function SchemaBuilder() {
  const location = useLocation();
  const state = (location.state as PrefillState) ?? {};

  const [name, setName] = useState(state.prefill?.name ?? "");
  const [version, setVersion] = useState(state.prefill?.version ?? "3.0.0");
  const [fields, setFields] = useState<FieldDef[]>(getInitialFields(state));

  const fieldsJson = JSON.stringify(fields.map((f) => ({ name: f.name, type: f.type })));
  const regArgs = [name, version, fieldsJson] as const;
  const canRegister = !!name && !!version && fields.length > 0 && fields.every((f) => f.name && f.type) && !!ADDRESSES.schemaRegistry;

  const computedSchemaId = (() => {
    if (!name || !version) return null;
    const compact = JSON.stringify(fields.map((f) => ({ name: f.name, type: f.type })));
    if (!compact) return null;
    return keccak256(encodePacked(["string", "string", "string"], [name, version, compact]));
  })();

  const simRequestRef = useRef<unknown | null>(null);

  const handleSimResult = useCallback((result: { request: unknown | null; error: string | null }) => {
    simRequestRef.current = result.request;
  }, []);

  const { writeContract, data: hash, isPending, error } = useWriteContract({
    mutation: {
      onError: (err) => toast("error", parseContractError(err)),
      onSuccess: () => toast("success", "Schema registered onchain"),
    },
  });

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const handleRegister = useCallback(() => {
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

  const pending = isPending || isConfirming;

  return (
    <div className="card">
      <h3 className="display--medium t-lg" style={{ marginBottom: "var(--space-2)" }}>Schema Builder</h3>
      <p className="t-sm c-muted" style={{ marginBottom: "var(--space-4)" }}>
        Define a custom claim schema. The schema ID is computed deterministically from name + version + fields.
      </p>

      {state.prefill && (
        <div
          className="chip chip--valid"
          style={{ marginBottom: "var(--space-4)", alignSelf: "flex-start" }}
        >
          Pre-filled from template: {state.prefill.name}
        </div>
      )}

      <div className="space-y-4" style={{ marginBottom: "var(--space-4)" }}>
        <Field label="Schema name" htmlFor="studio-schema-name" helper="Use snake_case. e.g. arcpass_myschema">
          <Input
            id="studio-schema-name"
            mono
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="arcpass_myschema"
          />
        </Field>
        <Field label="Version" htmlFor="studio-schema-version">
          <Input
            id="studio-schema-version"
            mono
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </Field>
        <div className="field">
          <label className="field__label">Fields</label>
          <FieldBuilder fields={fields} onChange={setFields} />
        </div>
      </div>

      {computedSchemaId && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <p className="eyebrow" style={{ marginBottom: "var(--space-1)" }}>Schema ID (live)</p>
          <div className="schema-compute">
            <div className="schema-compute__step">
              <span className="merkle-leaf" aria-hidden="true" />
              <span>name</span>
              <span className="schema-compute__arrow">→</span>
              <span className="schema-compute__value">{name || "(empty)"}</span>
            </div>
            <div className="schema-compute__step">
              <span className="merkle-leaf" aria-hidden="true" />
              <span>version</span>
              <span className="schema-compute__arrow">→</span>
              <span className="schema-compute__value">{version}</span>
            </div>
            <div className="schema-compute__step">
              <span className="merkle-leaf" aria-hidden="true" />
              <span>fieldsJson</span>
              <span className="schema-compute__arrow">→</span>
              <span className="schema-compute__value">{fieldsJson.length > 60 ? fieldsJson.slice(0, 57) + "..." : fieldsJson}</span>
            </div>
            <div className="schema-compute__step" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-2)", marginTop: "var(--space-1)" }}>
              <span className="merkle-leaf" aria-hidden="true" />
              <span>keccak256(abi.encodePacked(...))</span>
              <span className="schema-compute__arrow">→</span>
              <span className="schema-compute__value" style={{ color: "var(--color-verified)" }}>{computedSchemaId}</span>
            </div>
          </div>
        </div>
      )}

      <details style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
        <summary className="c-muted" style={{ cursor: "pointer" }}>▶ Preview JSON</summary>
        <CodeBlock style={{ marginTop: "var(--space-2)" }}>{fieldsJson}</CodeBlock>
      </details>

      <TransactionPreview
        enabled={canRegister}
        address={ADDRESSES.schemaRegistry}
        abi={SCHEMA_REGISTRY_ABI}
        functionName="registerSchema"
        args={regArgs}
        label="Schema Registration"
        onSimResult={handleSimResult}
      />

      <Button type="button" block disabled={pending || !canRegister} loading={pending} onClick={handleRegister}>
        Register Schema onchain
      </Button>

      <TxStatus hash={hash} />
      {error && <p className="c-danger t-sm text-center" style={{ marginTop: "var(--space-2)" }}>{parseContractError(error)}</p>}
    </div>
  );
}

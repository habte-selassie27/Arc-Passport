import { useState, useCallback, useMemo, useRef } from "react";
import { useWriteContract } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { ADDRESSES } from "../../config/addresses";
import { SCHEMA_REGISTRY_ABI } from "../../abis/SchemaRegistry";
import { TxStatus } from "../shared/TxStatus";
import { TransactionPreview } from "../shared/TransactionPreview";
import { GasEstimate } from "../shared/GasEstimate";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";

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

  const fieldsJson = JSON.stringify(fields.map((f) => ({ name: f.name, type: f.type })));
  const regArgs = [name, version, fieldsJson] as const;
  const simEnabled = !!name && !!version && fields.length > 0 && fields.every((f) => f.name && f.type) && !!ADDRESSES.schemaRegistry;

  const computedSchemaId = useMemo(() => {
    if (!name || !version || !fieldsJson) return null;
    return keccak256(encodePacked(["string", "string", "string"], [name, version, fieldsJson]));
  }, [name, version, fieldsJson]);

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
  }, [writeContract, name, version, fieldsJson, fields]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schema Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
          placeholder="kyc_basic"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version</label>
        <input
          type="text"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
          placeholder="1.0.0"
          required
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fields</label>
          <button
            type="button"
            onClick={addField}
            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            + Add Field
          </button>
        </div>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={field.name}
                onChange={(e) => updateField(i, "name", e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                placeholder="field_name"
              />
              <select
                value={field.type}
                onChange={(e) => updateField(i, "type", e.target.value)}
                className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
              >
                {SOLIDITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeField(i)}
                disabled={fields.length <= 1}
                className="px-2 py-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-30 transition-colors"
                title="Remove field"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {fieldsJson && (
        <details className="text-xs text-gray-400 dark:text-gray-500">
          <summary className="cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">Preview JSON</summary>
          <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
            {fieldsJson}
          </pre>
        </details>
      )}

      {computedSchemaId && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Computed Schema ID (preview)</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-gray-800 dark:text-gray-200 truncate bg-white dark:bg-gray-900 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
              {computedSchemaId}
            </code>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(computedSchemaId); toast("success", "Schema ID copied"); }}
              className="shrink-0 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300 transition-colors"
              title="Copy schema ID"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <TransactionPreview
        enabled={simEnabled}
        address={ADDRESSES.schemaRegistry}
        abi={SCHEMA_REGISTRY_ABI}
        functionName="registerSchema"
        args={regArgs}
        label="Schema Registration"
        onSimResult={handleSimResult}
      />

      <GasEstimate
        enabled={simEnabled}
        address={ADDRESSES.schemaRegistry}
        abi={SCHEMA_REGISTRY_ABI}
        functionName="registerSchema"
        args={regArgs}
      />

      <button
        type="submit"
        disabled={isPending || !simEnabled}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-all active:scale-[0.98] font-medium"
      >
        {isPending ? "Registering..." : "Register Schema"}
      </button>

      <TxStatus hash={hash} />
      {error && <p className="text-red-600 dark:text-red-400 text-sm text-center">{parseContractError(error)}</p>}
    </form>
  );
}

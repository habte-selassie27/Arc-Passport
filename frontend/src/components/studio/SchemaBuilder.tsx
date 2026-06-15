import { useState, useCallback, useRef } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ADDRESSES } from "../../config/addresses";
import { SCHEMA_REGISTRY_ABI } from "../../abis/SchemaRegistry";
import { FieldBuilder, type FieldDef } from "./FieldBuilder";
import { TxStatus } from "../shared/TxStatus";
import { TransactionPreview } from "../shared/TransactionPreview";
import { GasEstimate } from "../shared/GasEstimate";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";

export function SchemaBuilder() {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [fields, setFields] = useState<FieldDef[]>([{ name: "", type: "string" }]);

  const fieldsJson = JSON.stringify(fields.map((f) => ({ name: f.name, type: f.type })));
  const regArgs = [name, version, fieldsJson] as const;
  const canRegister = !!name && !!version && fields.length > 0 && fields.every((f) => f.name && f.type) && !!ADDRESSES.schemaRegistry;

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
  }, [writeContract, name, version, fieldsJson, fields]);

  const pending = isPending || isConfirming;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Schema Builder</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Define a custom claim schema. The schema ID is computed deterministically
        from name + version + fields.
      </p>

      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Schema name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="arcpass_myschema"
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Version</label>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Fields</label>
          <FieldBuilder fields={fields} onChange={setFields} />
        </div>
      </div>

      <details className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">Preview JSON</summary>
        <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
          {fieldsJson}
        </pre>
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

      <GasEstimate
        enabled={canRegister}
        address={ADDRESSES.schemaRegistry}
        abi={SCHEMA_REGISTRY_ABI}
        functionName="registerSchema"
        args={regArgs}
      />

      <button
        onClick={handleRegister}
        disabled={pending || !canRegister}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-all active:scale-[0.98] font-medium"
      >
        {pending ? "Registering..." : "Register Schema onchain"}
      </button>

      <TxStatus hash={hash} />
      {error && <p className="text-red-600 dark:text-red-400 text-sm text-center mt-2">{parseContractError(error)}</p>}
    </div>
  );
}

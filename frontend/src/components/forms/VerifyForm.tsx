import { useState, useMemo } from "react";
import { useReadContract } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { ADDRESSES } from "../../config/addresses";
import { AddressDisplay } from "../shared/AddressDisplay";
import { SCHEMA_TEMPLATES } from "../studio/SchemaTemplates";
import type { ServiceKey } from "../../types/passport";

const PASSPORT_VERIFIER_ABI = [
  {
    type: "function",
    name: "verify",
    inputs: [
      { name: "subject", type: "address" },
      { name: "schemaId", type: "bytes32" },
    ],
    outputs: [
      { name: "valid", type: "bool" },
      { name: "claimId", type: "bytes32" },
      { name: "issuer", type: "address" },
      { name: "issuedAt", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
      { name: "dataCommitment", type: "bytes32" },
    ],
    stateMutability: "view",
  },
] as const;

type SchemaOption = { label: string; service: string; schemaId: string };

const PRESET_SCHEMAS: SchemaOption[] = (Object.entries(SCHEMA_TEMPLATES) as [ServiceKey, typeof SCHEMA_TEMPLATES[ServiceKey]][]).flatMap(
  ([service, templates]) =>
    templates.map((t) => ({
      label: `${t.name} v${t.version}`,
      service,
      schemaId: keccak256(encodePacked(["string", "string", "string"], [t.name, t.version, JSON.stringify(t.fields.map((f: { name: string; type: string }) => ({ name: f.name, type: f.type })))])),
    }))
);

export function VerifyForm() {
  const [subject, setSubject] = useState("");
  const [schemaId, setSchemaId] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [inputMode, setInputMode] = useState<"preset" | "hex">("preset");
  const [shouldVerify, setShouldVerify] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const effectiveSchemaId = inputMode === "preset" ? selectedPreset : schemaId;

  const { data, isLoading, isError, error, fetchStatus } = useReadContract({
    address: ADDRESSES.passportVerifier,
    abi: PASSPORT_VERIFIER_ABI,
    functionName: "verify",
    args: [subject as `0x${string}`, effectiveSchemaId as `0x${string}`],
    query: { enabled: shouldVerify && !!subject && !!effectiveSchemaId && !!ADDRESSES.passportVerifier },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);
    if (!ADDRESSES.passportVerifier) {
      setConfigError("PassportVerifier contract address is not configured. Set VITE_PASSPORT_VERIFIER_ADDRESS in your .env file.");
      return;
    }
    if (!effectiveSchemaId) {
      setConfigError("Select a schema or enter a schema ID.");
      return;
    }
    if (!subject || !subject.startsWith("0x")) {
      setConfigError("Enter a valid subject address starting with 0x.");
      return;
    }
    setShouldVerify(true);
  };

  const result = data as [boolean, `0x${string}`, `0x${string}`, bigint, bigint, `0x${string}`] | undefined;
  const selectedLabel = PRESET_SCHEMAS.find((s) => s.schemaId === effectiveSchemaId)?.label;
  const querying = isLoading && fetchStatus === "fetching";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject Address</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setShouldVerify(false); setConfigError(null); }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-shadow"
          placeholder="0x..."
          required
        />
      </div>

      <div className="flex gap-2 mb-1">
        <button
          type="button"
          onClick={() => setInputMode("preset")}
          className={`px-3 py-1 text-xs rounded-t-md border-b-0 transition-colors ${
            inputMode === "preset"
              ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-gray-300 dark:border-gray-600 font-semibold"
              : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
          }`}
        >
          Pick a schema
        </button>
        <button
          type="button"
          onClick={() => setInputMode("hex")}
          className={`px-3 py-1 text-xs rounded-t-md border-b-0 transition-colors ${
            inputMode === "hex"
              ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-gray-300 dark:border-gray-600 font-semibold"
              : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
          }`}
        >
          Enter hex ID
        </button>
      </div>

      {inputMode === "preset" ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schema</label>
          <select
            value={selectedPreset}
            onChange={(e) => { setSelectedPreset(e.target.value); setShouldVerify(false); setConfigError(null); }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-shadow text-sm"
            required
          >
            <option value="">-- Select schema --</option>
            {PRESET_SCHEMAS.map((s) => (
              <option key={s.schemaId} value={s.schemaId}>
                {s.label} ({s.service})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schema ID (hex)</label>
          <input
            type="text"
            value={schemaId}
            onChange={(e) => { setSchemaId(e.target.value); setShouldVerify(false); setConfigError(null); }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-shadow"
            placeholder="0x..."
            required
          />
        </div>
      )}

      <button
        type="submit"
        disabled={querying || !effectiveSchemaId || !subject}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-all active:scale-[0.98] font-medium"
      >
        {querying ? "Verifying..." : "Verify Credential"}
      </button>

      {configError && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-800 dark:text-yellow-300 text-sm">
          {configError}
        </div>
      )}

      {querying && (
        <div className="text-center py-4">
          <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Checking on-chain credential...</p>
        </div>
      )}

      {result && !querying && (
        <div className={`p-4 rounded-md border transition-all ${
          result[0]
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        }`}>
          <p className={`font-bold ${result[0] ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
            {result[0] ? "Valid Credential" : "No Valid Credential Found"}
          </p>
          {selectedLabel && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Schema: {selectedLabel}</p>
          )}
          {result[0] ? (
            <div className="mt-2 text-xs space-y-1 text-gray-600 dark:text-gray-400">
              <p>Claim: <span className="font-mono">{result[1].slice(0, 16)}...</span></p>
              <p>Issuer: <AddressDisplay address={result[2]} /></p>
              <p>Issued: {new Date(Number(result[3]) * 1000).toLocaleString()}</p>
              {result[4] > 0n && <p>Expires: {new Date(Number(result[4]) * 1000).toLocaleString()}</p>}
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              The subject does not have a valid claim for this schema. They may need to get verified by an issuer first.
            </p>
          )}
        </div>
      )}

      {isError && !querying && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {(error as Error)?.message || "Verification failed"}
        </div>
      )}
    </form>
  );
}

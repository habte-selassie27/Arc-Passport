import { useState } from "react";
import { useReadContract } from "wagmi";
import { ADDRESSES } from "../../config/addresses";
import { AddressDisplay } from "../ui/AddressDisplay";
import { PRESET_SCHEMAS } from "../../utils/schemaNames";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { StatusChip } from "../ui/StatusChip";

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

function formatDate(ts: bigint): string {
  if (ts <= 0n) return "—";
  return new Date(Number(ts) * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function VerifyForm() {
  const [subject, setSubject] = useState("");
  const [schemaId, setSchemaId] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [shouldVerify, setShouldVerify] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const effectiveSchemaId = manualOpen ? schemaId : selectedPreset;

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Subject Address" htmlFor="verify-subject" helper="Any wallet address on Arc Testnet.">
        <Input
          id="verify-subject"
          mono
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setShouldVerify(false);
            setConfigError(null);
          }}
          placeholder="0x..."
          required
        />
      </Field>

      <div className="field">
        <label className="field__label" htmlFor="verify-schema">Schema</label>
        <Select
          id="verify-schema"
          value={selectedPreset}
          onChange={(e) => {
            setSelectedPreset(e.target.value);
            setShouldVerify(false);
            setConfigError(null);
          }}
          disabled={manualOpen}
        >
          <option value="">-- Select schema --</option>
          {PRESET_SCHEMAS.map((s) => (
            <option key={s.schemaId} value={s.schemaId}>
              {s.label} ({s.service})
            </option>
          ))}
        </Select>
        <div style={{ marginTop: "var(--space-2)" }}>
          {manualOpen ? (
            <button
              type="button"
              className="btn btn--link btn--sm"
              onClick={() => {
                setManualOpen(false);
                setShouldVerify(false);
              }}
            >
              ← Pick a schema from the list
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--link btn--sm"
              onClick={() => {
                setManualOpen(true);
                setShouldVerify(false);
              }}
            >
              Enter schema ID manually
            </button>
          )}
        </div>
      </div>

      {manualOpen && (
        <Field label="Schema ID (hex)" htmlFor="verify-hex">
          <Input
            id="verify-hex"
            mono
            type="text"
            value={schemaId}
            onChange={(e) => {
              setSchemaId(e.target.value);
              setShouldVerify(false);
              setConfigError(null);
            }}
            placeholder="0x..."
          />
        </Field>
      )}

      <Button type="submit" block disabled={querying || !effectiveSchemaId || !subject} loading={querying}>
        Verify Credential
      </Button>

      {configError && (
        <p className="c-warn t-sm" role="alert" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)" }}>
          {configError}
        </p>
      )}

      {result && !querying && result[0] && (
        <Card verified style={{ marginTop: "var(--space-4)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-3)" }}>
            <div className="flex items-center gap-2">
              <span className="merkle-leaf" aria-hidden="true" />
              <p className="card__title">{selectedLabel ?? "Verified credential"}</p>
            </div>
            <StatusChip status="VALID" />
          </div>
          {/* Verification proof summary */}
          <div className="verification-pulse" style={{ marginBottom: "var(--space-3)" }}>
            <span className="verification-pulse__dot" aria-hidden="true" />
            <span>On-chain verification passed — claim is valid, not revoked, not expired</span>
          </div>
          <div>
            <div className="data-row">
              <span className="data-row__label">Subject</span>
              <span className="data-row__value"><AddressDisplay address={subject as `0x${string}`} /></span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Issuer</span>
              <span className="data-row__value"><AddressDisplay address={result[2]} /></span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Issued</span>
              <span className="data-row__value">{formatDate(result[3])}</span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Expires</span>
              <span className="data-row__value">{result[4] > 0n ? formatDate(result[4]) : "Never"}</span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Claim ID</span>
              <span className="data-row__value data-row__value--mono">
                <AddressDisplay address={result[1]} truncate={false} />
              </span>
            </div>
          </div>
          {/* Data commitment — the Merkle root stored on-chain */}
          <div style={{ marginTop: "var(--space-3)" }}>
            <div className="commitment">
              <span className="merkle-leaf" aria-hidden="true" />
              <span className="commitment__label">dataCommitment</span>
              <span className="commitment__hash">{result[5].slice(0, 18)}…{result[5].slice(-6)}</span>
            </div>
          </div>
        </Card>
      )}

      {result && !querying && !result[0] && (
        <Card revoked style={{ marginTop: "var(--space-4)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-3)" }}>
            <p className="card__title">No valid attestation</p>
            <StatusChip status="REVOKED" />
          </div>
          <p className="card__desc">
            No valid attestation found for this address and schema combination. The credential may
            not exist, may be revoked, or may have expired.
          </p>
          <div className="commitment" style={{ marginTop: "var(--space-3)", opacity: 0.5 }}>
            <span className="merkle-leaf merkle-leaf--off" aria-hidden="true" />
            <span className="commitment__label">commitment</span>
            <span className="commitment__hash">no valid claim</span>
          </div>
        </Card>
      )}

      {isError && !querying && (
        <p className="c-danger t-sm" role="alert">
          {(error as Error)?.message || "Verification failed"}
        </p>
      )}

      {querying && (
        <div className="text-center" style={{ padding: "var(--space-4) 0" }}>
          <span className="spinner" style={{ margin: "0 auto var(--space-2)", display: "block" }} aria-hidden="true" />
          <p className="c-subtle t-xs">Checking on-chain credential…</p>
        </div>
      )}
    </form>
  );
}

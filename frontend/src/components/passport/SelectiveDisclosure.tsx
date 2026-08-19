import { useState } from "react";
import { Card } from "../ui/Card";

interface DisclosureField {
  name: string;
  type: string;
  classification: "PUBLIC" | "PRIVATE" | "DERIVED";
  value: unknown;
}

interface SelectiveDisclosureProps {
  claimId: string;
  field: DisclosureField;
  proof: string[];
  leaf: string;
  leafIndex: number;
  onClose: () => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

function copyToClipboard(text: string) {
  return navigator.clipboard.writeText(text);
}

export function SelectiveDisclosure({
  claimId,
  field,
  proof,
  leaf,
  leafIndex,
  onClose,
}: SelectiveDisclosureProps) {
  const [copied, setCopied] = useState(false);

  const disclosurePayload = JSON.stringify({
    claimId,
    fieldName: field.name,
    leaf,
    proof,
    leafIndex,
    value: field.value,
  });

  const handleCopy = async () => {
    await copyToClipboard(disclosurePayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareUrl = () => {
    const params = new URLSearchParams({
      leaf,
      leafIndex: String(leafIndex),
      proof: JSON.stringify(proof),
    });
    const url = `${window.location.origin}/verify?claimId=${claimId}&field=${field.name}&${params.toString()}`;
    copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="t-lg fw-600" style={{ marginBottom: "var(--space-3)" }}>
          Disclose Field
        </h3>

        <Card style={{ padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
          <div className="data-row">
            <span className="data-row__label">Field</span>
            <span className="data-row__value fw-600">{field.name}</span>
          </div>
          <div className="data-row">
            <span className="data-row__label">Type</span>
            <span className="data-row__value mono t-xs">{field.type}</span>
          </div>
          <div className="data-row">
            <span className="data-row__label">Value</span>
            <span className="data-row__value mono">{formatValue(field.value)}</span>
          </div>
          <div className="data-row">
            <span className="data-row__label">Leaf</span>
            <span className="data-row__value mono t-xs" style={{ wordBreak: "break-all" }}>
              {leaf.slice(0, 18)}…{leaf.slice(-8)}
            </span>
          </div>
          <div className="data-row">
            <span className="data-row__label">Leaf index</span>
            <span className="data-row__value mono">{leafIndex}</span>
          </div>
        </Card>

        <p className="t-sm c-subtle" style={{ marginBottom: "var(--space-3)" }}>
          This proof is cryptographically bound to claim <code className="mono t-xs">{claimId.slice(0, 14)}…</code>.
          Anyone with this proof can verify the field on-chain, but only if you also share the value separately.
        </p>

        <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn--secondary btn--sm" onClick={handleCopy}>
            {copied ? "Copied ✓" : "Copy Proof JSON"}
          </button>
          <button className="btn btn--primary btn--sm" onClick={handleShareUrl}>
            Copy Shareable Link
          </button>
        </div>

        <button
          className="btn btn--link btn--sm"
          onClick={onClose}
          style={{ marginTop: "var(--space-3)", width: "100%", textAlign: "center" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

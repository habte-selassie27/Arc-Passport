import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { StatusChip } from "../ui/StatusChip";
import { AddressDisplay } from "../ui/AddressDisplay";
import { SelectiveDisclosure } from "./SelectiveDisclosure";
import type { ActiveClaim } from "../../types/passport";
import type { ClaimFieldClassification, FieldProof } from "../../hooks/useFieldProof";

interface CredentialCardProps {
  claim: ActiveClaim;
  schemaName?: string;
  /** Field classifications fetched by the Passport page (optional). */
  fields?: ClaimFieldClassification[];
  /** Called when user clicks "Disclose" on a PRIVATE field. */
  onRequestProof?: (fieldName: string) => void;
  /** The generated proof (set after onRequestProof resolves). */
  proofResult?: FieldProof | null;
  /** True while a proof is being fetched. */
  proofLoading?: boolean;
}

function ClassificationBadge({ classification }: { classification: string }) {
  const cls = classification.toLowerCase();
  return (
    <span className={`badge badge--${cls}`}>
      {cls === "private" && <span className="lock-icon" aria-label="Private">🔒</span>}
      {classification}
    </span>
  );
}

export function CredentialCard({
  claim,
  schemaName,
  fields,
  onRequestProof,
  proofResult,
  proofLoading,
}: CredentialCardProps) {
  const valid = claim.valid;
  const [disclosingField, setDisclosingField] = useState<
    (ClaimFieldClassification & { value: unknown }) | null
  >(null);

  const handleProofReady = (fieldName: string) => {
    if (proofResult && proofResult.field.name === fieldName) {
      setDisclosingField({
        ...proofResult.field,
        value: proofResult.field.value,
      });
    }
  };

  return (
    <Card verified={valid} revoked={!valid} style={{ padding: "var(--space-4) var(--space-5)" }}>
      <div className="flex items-center justify-between gap-3" style={{ marginBottom: "var(--space-2)" }}>
        <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
          <span className={`merkle-leaf${valid ? "" : " merkle-leaf--off"}`} aria-hidden="true" />
          <p className="mono t-sm" style={{ color: "var(--color-on-bright)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {schemaName ?? `${claim.schemaId.slice(0, 14)}...`}
          </p>
        </div>
        <StatusChip status={valid ? "VALID" : "REVOKED"} />
      </div>
      <div className="data-row">
        <span className="data-row__label">Issuer</span>
        <span className="data-row__value">
          <AddressDisplay address={claim.issuer} />
        </span>
      </div>
      <div className="data-row">
        <span className="data-row__label">Claim ID</span>
        <span className="data-row__value data-row__value--mono">
          <AddressDisplay address={claim.claimId} />
        </span>
      </div>

      {/* Field classifications */}
      {fields && fields.length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-1)" }}>Fields</p>
          <div className="flex flex-col gap-1">
            {fields.map((f) => (
              <div key={f.name} className="flex items-center justify-between gap-2" style={{ padding: "2px 0" }}>
                <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                  <span className="mono t-xs" style={{ color: "var(--color-on-bright)" }}>{f.name}</span>
                  <ClassificationBadge classification={f.classification} />
                </div>
                {f.classification === "PRIVATE" && valid && (
                  <button
                    className="btn btn--link btn--xs"
                    disabled={proofLoading}
                    onClick={() => {
                      onRequestProof?.(f.name);
                      // Poll for proof result (simple approach — parent sets proofResult)
                      const check = setInterval(() => {
                        if (proofResult && proofResult.field.name === f.name) {
                          clearInterval(check);
                          handleProofReady(f.name);
                        }
                      }, 100);
                      setTimeout(() => clearInterval(check), 10_000);
                    }}
                  >
                    {proofLoading ? "…" : "Disclose"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commitment hash */}
      <div style={{ marginTop: "var(--space-2)" }}>
        <div className="commitment">
          <span className="merkle-leaf" aria-hidden="true" />
          <span className="commitment__label">commitment</span>
          <span className="commitment__hash">{claim.claimId.slice(0, 18)}…{claim.claimId.slice(-6)}</span>
        </div>
      </div>
      {!valid && (
        <p className="t-xs c-subtle" style={{ marginTop: "var(--space-2)" }}>
          This credential is revoked, expired, or otherwise invalid on-chain.
        </p>
      )}
      <div style={{ marginTop: "var(--space-3)", display: "flex", justifyContent: "flex-end" }}>
        <Link to="/verify" className="btn btn--link btn--sm">
          Verify ↗
        </Link>
      </div>

      {/* Disclosure modal */}
      {disclosingField && proofResult && (
        <SelectiveDisclosure
          claimId={claim.claimId}
          field={disclosingField}
          proof={proofResult.proof}
          leaf={proofResult.leaf}
          leafIndex={proofResult.leafIndex}
          onClose={() => setDisclosingField(null)}
        />
      )}
    </Card>
  );
}

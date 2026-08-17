import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { StatusChip } from "../ui/StatusChip";
import { AddressDisplay } from "../ui/AddressDisplay";
import type { ActiveClaim } from "../../types/passport";

interface CredentialCardProps {
  claim: ActiveClaim;
  schemaName?: string;
}

export function CredentialCard({ claim, schemaName }: CredentialCardProps) {
  const valid = claim.valid;

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
      {/* Commitment hash — the on-chain data commitment (Merkle root) */}
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
    </Card>
  );
}

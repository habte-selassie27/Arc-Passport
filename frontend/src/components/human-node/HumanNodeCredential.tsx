import { Card } from "../ui/Card";
import { AddressDisplay } from "../ui/AddressDisplay";
import type { HumanityStatus } from "../../hooks/useHumanode";

function formatDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function HumanNodeCredential({ status }: { status: HumanityStatus }) {
  const explorerBase = "https://testnet.arcscan.app";
  return (
    <Card verified style={{ maxWidth: 560, margin: "0 auto" }}>
      <p className="eyebrow">Humanity Credential</p>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
        <span className="chip chip--valid">
          <span className="dot dot--on" aria-hidden="true" />
          UNIQUE HUMAN
        </span>
        <span className="t-xs c-subtle">Proof of Biometric Uniqueness</span>
      </div>

      <div className="data-rows" style={{ marginTop: "var(--space-4)" }}>
        <div className="data-row">
          <span className="data-row__label">Wallet</span>
          <AddressDisplay address={status.subject} />
        </div>
        <div className="data-row">
          <span className="data-row__label">Mechanism</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>
            {status.mechanism ?? "humanode"}
          </span>
        </div>
        <div className="data-row">
          <span className="data-row__label">Verified</span>
          <span className="t-sm" style={{ color: "var(--color-verified)" }}>
            {status.checkedAt ? formatDate(status.checkedAt) : "—"}
          </span>
        </div>
        <div className="data-row">
          <span className="data-row__label">Valid until</span>
          <span className="t-sm">{formatDate(status.expiresAt)}</span>
        </div>
        {status.claimId && (
          <div className="data-row">
            <span className="data-row__label">Claim</span>
            <a
              className="mono t-xs link"
              href={`${explorerBase}/tx/${status.claimId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {status.claimId.slice(0, 10)}…{status.claimId.slice(-8)} ↗
            </a>
          </div>
        )}
      </div>

      <p className="t-xs c-subtle" style={{ marginTop: "var(--space-4)", lineHeight: 1.6 }}>
        Your biometric information is never shared with ArcPass. Only a cryptographic
        commitment to <span className="mono">uniqueHuman = true</span> is stored on-chain.
      </p>
    </Card>
  );
}

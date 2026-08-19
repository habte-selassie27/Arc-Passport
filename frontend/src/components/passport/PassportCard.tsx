import { QRCodeSVG } from "qrcode.react";
import { AddressDisplay } from "../ui/AddressDisplay";
import { CredentialCard } from "./CredentialCard";
import { ServiceBadge } from "./ServiceBadge";
import { ScoreDisplay } from "./ScoreDisplay";
import { LogoMark } from "../ui/LogoMark";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { ALL_SERVICE_KEYS, SERVICE_LABELS, type PassportDocument, type ServiceKey, type ActiveClaim, type TrustScore, type OnChainScore } from "../../types/passport";
import { schemaNameForId } from "../../utils/schemaNames";
import type { ClaimFieldClassification, FieldProof } from "../../hooks/useFieldProof";

interface PassportCardProps {
  passport: PassportDocument;
  /** Field classifications keyed by claimId (fetched for the subject's own claims). */
  claimFields?: Record<string, ClaimFieldClassification[]>;
  /** Called when user clicks "Disclose" on a PRIVATE field. */
  onRequestProof?: (claimId: string, fieldName: string) => void;
  /** The currently generated proof (if any). */
  proofResult?: FieldProof | null;
  /** True while a proof is being fetched. */
  proofLoading?: boolean;
}

/** Trust Score display — the composite weighted score with category breakdown. */
function TrustScoreDisplay({ trustScore }: { trustScore: TrustScore }) {
  const scoreColor = trustScore.passed ? "var(--color-verified)" : "var(--color-warning)";
  const activeCategories = trustScore.categories.filter((c) => c.claimCount > 0);

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>
        Trust Score
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <span
          className="mono t-3xl"
          style={{ color: scoreColor, fontWeight: 700 }}
        >
          {trustScore.score}
        </span>
        <span className="t-xs c-subtle">/ {trustScore.threshold} threshold</span>
      </div>
      <div
        style={{
          marginTop: "var(--space-2)",
          height: 6,
          borderRadius: 3,
          background: "var(--color-surface-1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min((trustScore.score / 100) * 100, 100)}%`,
            height: "100%",
            background: scoreColor,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-x-4" style={{ marginTop: "var(--space-3)" }}>
        <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
          <span className="data-row__label t-xs">Attestations</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>
            {trustScore.totalClaims}
          </span>
        </div>
        <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
          <span className="data-row__label t-xs">Unique issuers</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>
            {trustScore.totalIssuers}
          </span>
        </div>
        <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
          <span className="data-row__label t-xs">Categories</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>
            {trustScore.activeCategories.length}/{trustScore.categories.length}
          </span>
        </div>
        <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
          <span className="data-row__label t-xs">Status</span>
          <span
            className="t-sm"
            style={{ color: trustScore.passed ? "var(--color-verified)" : "var(--color-warning)" }}
          >
            {trustScore.passed ? "Passed" : "Below threshold"}
          </span>
        </div>
      </div>
      {activeCategories.length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-1)" }}>Category breakdown</p>
          {activeCategories.map((cat) => (
            <div key={cat.service} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span className="t-xs">{cat.label}</span>
              <span className="mono t-xs" style={{ color: "var(--color-on-bright)" }}>
                {cat.claimCount} claim{cat.claimCount !== 1 ? "s" : ""} · {cat.score.toFixed(1)} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Transparent reputation signals — counters derived from on-chain claims. */
function ReputationSignals({ passport }: { passport: PassportDocument }) {
  const claims: ActiveClaim[] = (Object.values(passport.services) as { claims: ActiveClaim[] }[]).flatMap((s) => s.claims ?? []);
  const validCount = claims.filter((c) => c.valid).length;
  const revokedCount = claims.filter((c) => !c.valid).length;
  const uniqueIssuers = new Set(claims.map((c) => c.issuer.toLowerCase())).size;
  const servicesWithClaims = Object.values(passport.services).filter((s) => (s.claimCount ?? 0) > 0 || (s.claims?.length ?? 0) > 0).length;

  const rows = [
    { label: "Verified attestations", value: validCount, color: validCount > 0 ? "var(--color-verified)" : undefined },
    { label: "Total claims", value: claims.length },
    { label: "Unique issuers", value: uniqueIssuers },
    { label: "Services covered", value: servicesWithClaims },
  ];

  if (revokedCount > 0) {
    rows.push({ label: "Revoked", value: revokedCount, color: "var(--color-danger)" });
  }

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>
        On-chain signals
      </p>
      <div className="grid grid-cols-2 gap-x-4">
        {rows.map((r) => (
          <div key={r.label} className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
            <span className="data-row__label t-xs">{r.label}</span>
            <span className="mono t-sm" style={{ color: r.color ?? "var(--color-on-bright)" }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PassportCard({ passport, claimFields, onRequestProof, proofResult, proofLoading }: PassportCardProps) {
  const qrValue = `${window.location.origin}/passport/${passport.address}`;
  const name = passport.metadata?.name;

  const servicesWithClaims = (ALL_SERVICE_KEYS as ServiceKey[]).filter((key) => {
    const svc = passport.services?.[key];
    return svc && ((svc.claimCount ?? 0) > 0 || (svc.claims?.length ?? 0) > 0);
  });

  const credentialGroups = (ALL_SERVICE_KEYS as ServiceKey[]).filter((key) => {
    const svc = passport.services?.[key];
    return svc && (svc.claims?.length ?? 0) > 0;
  });

  return (
    <div className="passport-grid">
      {/* ---- Left: identity card ---- */}
      <section className="card" aria-label="Identity">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-center justify-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--color-surface-1)",
              color: "var(--color-subtle)",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <LogoMark size={30} />
          </div>
          <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--color-border)" }}>
            <QRCodeSVG value={qrValue} size={64} aria-label={`QR code for passport ${passport.address}`} />
          </div>
        </div>

        <div style={{ marginTop: "var(--space-4)" }}>
          <AddressDisplay address={passport.address} />
          <p className="display--medium t-xl" style={{ marginTop: 2 }}>
            {name ?? "Unregistered identity"}
          </p>
          <p className="t-xs c-subtle" style={{ marginTop: 2 }}>
            Arc Testnet{passport.identityId > 0 ? ` · Identity token #${passport.identityId}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2" style={{ marginTop: "var(--space-3)" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigator.clipboard.writeText(passport.address)}
          >
            Copy address
          </Button>
          <a
            href={`https://testnet.arcscan.app/address/${passport.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--ghost btn--sm"
          >
            View on explorer ↗
          </a>
        </div>

        {servicesWithClaims.length > 0 && (
          <div style={{ marginTop: "var(--space-5)" }}>
            <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>
              Service coverage
            </p>
            <div className="flex flex-wrap gap-2">
              {servicesWithClaims.map((key) => {
                const svc = passport.services[key];
                return (
                  <ServiceBadge
                    key={key}
                    name={SERVICE_LABELS[key] ?? key}
                    verified={svc.verified}
                    claimCount={svc.claimCount}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: "var(--space-5)" }}>
          <TrustScoreDisplay trustScore={passport.trustScore} />
        </div>
        {passport.onChainScore && (
          <div style={{ marginTop: "var(--space-5)" }}>
            <ScoreDisplay score={passport.onChainScore} variant="compact" />
            <a
              href={`/score/${passport.address}`}
              className="btn btn--ghost btn--sm"
              style={{ marginTop: "var(--space-2)", display: "inline-block" }}
            >
              View full score →
            </a>
          </div>
        )}
        <div style={{ marginTop: "var(--space-5)" }}>
          <ReputationSignals passport={passport} />
        </div>

        <p className="t-xs c-subtle" style={{ marginTop: "var(--space-4)" }}>
          Generated: {new Date(passport.generatedAt).toLocaleString()}
        </p>

        {/* Verification status — always visible */}
        {servicesWithClaims.length > 0 ? (
          <div className="verification-pulse" style={{ marginTop: "var(--space-3)" }}>
            <span className="verification-pulse__dot" aria-hidden="true" />
            <span>Passport verified — {servicesWithClaims.length} service{servicesWithClaims.length !== 1 ? "s" : ""} with valid attestations</span>
          </div>
        ) : (
          <div className="verification-pulse" style={{ marginTop: "var(--space-3)", opacity: 0.6 }}>
            <span className="verification-pulse__dot" aria-hidden="true" />
            <span>No attestations yet</span>
          </div>
        )}
      </section>

      {/* ---- Right: credentials ---- */}
      <div className="grid gap-6">
        {credentialGroups.length === 0 ? (
          <section className="card" aria-label="Credentials">
            <div className="empty">
              <LogoMark size={32} className="empty__icon" />
              <p className="empty__title">No credentials yet</p>
              <p className="empty__body">
                An attestation is a cryptographic commitment issued by an authorized issuer
                and stored on-chain. When an issuer attests to this address, a Merkle root
                of the claim data is committed to the AttestationRegistry — verifiable by
                anyone, revocable by the issuer.
              </p>
              <div className="verification-pulse" style={{ marginTop: "var(--space-4)" }}>
                <span className="verification-pulse__dot" aria-hidden="true" />
                <span>Waiting for first attestation</span>
              </div>
              <div className="empty__action" style={{ marginTop: "var(--space-4)" }}>
                <a href={`/verify`} className="btn btn--ghost btn--sm">
                  Verify on-chain ↗
                </a>
              </div>
            </div>
          </section>
        ) : (
          credentialGroups.map((key) => {
            const svc = passport.services[key];
            return (
              <section key={key} aria-label={SERVICE_LABELS[key]}>
                <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-3)" }}>
                  <p className="eyebrow">{SERVICE_LABELS[key].toUpperCase()}</p>
                  {(svc.claimCount ?? 0) > (svc.claims?.length ?? 0) && (
                    <span className="chip chip--muted">{svc.claimCount} on-chain</span>
                  )}
                </div>
                <div className="grid gap-3">
                  {(svc.claims ?? []).map((c) => (
                    <CredentialCard
                      key={c.claimId}
                      claim={c}
                      schemaName={schemaNameForId(c.schemaId)}
                      fields={claimFields?.[c.claimId]}
                      onRequestProof={(fieldName) => onRequestProof?.(c.claimId, fieldName)}
                      proofResult={proofResult?.claimId === c.claimId ? proofResult : null}
                      proofLoading={proofLoading}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

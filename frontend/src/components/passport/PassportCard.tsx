import { QRCodeSVG } from "qrcode.react";
import { AddressDisplay } from "../ui/AddressDisplay";
import { CredentialCard } from "./CredentialCard";
import { ServiceBadge } from "./ServiceBadge";
import { ScoreDisplay } from "./ScoreDisplay";
import { CoverCard } from "./CoverCard";
import { ShareButton } from "./ShareButton";
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

/** Trust Score display — gamified quest with category progress. */
export function TrustScoreDisplay({ trustScore }: { trustScore: TrustScore }) {
  const scoreColor = trustScore.passed ? "var(--color-verified)" : "var(--color-warn)";
  const maxScore = trustScore.threshold;
  const progress = Math.min((trustScore.score / maxScore) * 100, 100);

  /** Category display config — colors and icons per service. */
  const CAT_CONFIG: Record<string, { icon: string; color: string; points: number }> = {
    kyc:         { icon: "🛡️", color: "#00E5A0", points: 10 },
    credentials: { icon: "📜", color: "#8B5CF6", points: 8 },
    employment:  { icon: "💼", color: "#06B6D4", points: 5 },
    education:   { icon: "🎓", color: "#10B981", points: 5 },
    dao:         { icon: "🏛️", color: "#F59E0B", points: 7 },
    reputation:  { icon: "⭐", color: "#EC4899", points: 3 },
    social:      { icon: "🔗", color: "#F97316", points: 2 },
    identity:    { icon: "🪪", color: "#3B82F6", points: 4 },
    custom:      { icon: "✨", color: "#6366F1", points: 2 },
  };

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>
        Trust Score
      </p>

      {/* Score number + progress bar */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <span
          className="mono t-3xl"
          style={{ color: scoreColor, fontWeight: 700 }}
        >
          {trustScore.score}
        </span>
        <span className="t-xs c-subtle">/ {maxScore} to pass</span>
      </div>
      <div
        style={{
          marginTop: "var(--space-2)",
          height: 8,
          borderRadius: 4,
          background: "var(--color-surface-1)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: trustScore.passed
              ? `linear-gradient(90deg, ${scoreColor}, #00E5A0)`
              : `linear-gradient(90deg, ${scoreColor}CC, ${scoreColor})`,
            borderRadius: 4,
            transition: "width 0.5s var(--ease-out-quart)",
          }}
        />
        {/* Threshold marker */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: -1,
            bottom: -1,
            width: 2,
            background: "var(--color-on-bright)",
            borderRadius: 1,
            opacity: 0.3,
          }}
        />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-x-4" style={{ marginTop: "var(--space-3)" }}>
        <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
          <span className="data-row__label t-xs">Attestations</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>
            {trustScore.totalClaims}
          </span>
        </div>
        <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
          <span className="data-row__label t-xs">Issuers</span>
          <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>
            {trustScore.totalIssuers}
          </span>
        </div>
      </div>

      {/* Category quest chips */}
      <div style={{ marginTop: "var(--space-3)" }}>
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>Quest progress</p>
        <div className="grid gap-1">
          {trustScore.categories.map((cat) => {
            const cfg = CAT_CONFIG[cat.service] || { icon: "•", color: "var(--color-muted)", points: 1 };
            const isActive = cat.claimCount > 0;
            const pct = cat.maxPossible > 0 ? Math.min((cat.score / cat.maxPossible) * 100, 100) : 0;

            return (
              <div
                key={cat.service}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "var(--space-1) var(--space-2)",
                  borderRadius: "var(--radius-sm)",
                  background: isActive ? `${cfg.color}08` : "transparent",
                  border: `1px solid ${isActive ? `${cfg.color}30` : "var(--color-border)"}`,
                }}
              >
                <span style={{ fontSize: "0.8rem", width: 20, textAlign: "center", flexShrink: 0 }}>{cfg.icon}</span>
                <span
                  className="t-xs"
                  style={{
                    flex: 1,
                    color: isActive ? "var(--color-on-surface)" : "var(--color-subtle)",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {cat.label}
                </span>
                {/* Mini progress bar */}
                <div
                  style={{
                    width: 48,
                    height: 4,
                    borderRadius: 2,
                    background: "var(--color-surface-2)",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: isActive ? cfg.color : "var(--color-subtle)",
                      borderRadius: 2,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <span
                  className="mono t-xs"
                  style={{
                    color: isActive ? cfg.color : "var(--color-subtle)",
                    fontWeight: 600,
                    minWidth: 28,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {isActive ? "+" : "+"}{cat.score > 0 ? cat.score.toFixed(0) : cfg.points}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status callout */}
      <div
        style={{
          marginTop: "var(--space-3)",
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-md)",
          background: trustScore.passed ? "rgba(0,229,160,0.06)" : "rgba(245,158,11,0.06)",
          border: `1px solid ${trustScore.passed ? "rgba(0,229,160,0.2)" : "rgba(245,158,11,0.2)"}`,
        }}
      >
        <p
          className="t-xs"
          style={{ color: trustScore.passed ? "var(--color-verified)" : "var(--color-warn)", fontWeight: 600 }}
        >
          {trustScore.passed
            ? `✓ Trust threshold passed — ${trustScore.activeCategories.length} active categories`
            : `${maxScore - trustScore.score} more points needed — add credentials to pass`}
        </p>
      </div>
    </div>
  );
}

/** Transparent reputation signals — counters derived from on-chain claims. */
export function ReputationSignals({ passport }: { passport: PassportDocument }) {
  const claims: ActiveClaim[] = (Object.values(passport.services) as { claims: ActiveClaim[] }[]).flatMap((s) => s.claims ?? []);
  const validCount = claims.filter((c) => c.valid).length;
  const revokedCount = claims.filter((c) => !c.valid && !c.validationFailed).length;
  const unverifiedCount = claims.filter((c) => !c.valid && c.validationFailed).length;
  const selfIssuedCount = claims.filter((c) => c.issuer.toLowerCase() === passport.address.toLowerCase()).length;
  const allSelfIssued = claims.length > 0 && selfIssuedCount === claims.length;
  const uniqueIssuers = new Set(claims.map((c) => c.issuer.toLowerCase())).size;
  const servicesWithClaims = Object.values(passport.services).filter((s) => (s.claimCount ?? 0) > 0 || (s.claims?.length ?? 0) > 0).length;

  const rows = [
    { label: "Verified attestations", value: validCount, color: validCount > 0 ? "var(--color-verified)" : undefined },
    { label: "Total claims", value: claims.length },
    { label: "Unique issuers", value: uniqueIssuers },
    { label: "Services covered", value: servicesWithClaims },
  ];

  if (allSelfIssued && claims.length > 0) {
    rows.push({ label: "Self-issued", value: selfIssuedCount, color: "var(--color-subtle)" });
  } else {
    if (revokedCount > 0) {
      rows.push({ label: "Revoked", value: revokedCount, color: "var(--color-danger)" });
    }
    if (unverifiedCount > 0) {
      rows.push({ label: "Unverified", value: unverifiedCount, color: "var(--color-warn)" });
    }
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

export function HistorySection({ passport, claimFields, onRequestProof, proofResult, proofLoading }: {
  passport: PassportDocument;
  claimFields?: Record<string, ClaimFieldClassification[]>;
  onRequestProof?: (claimId: string, fieldName: string) => void;
  proofResult?: FieldProof | null;
  proofLoading?: boolean;
}) {
  const historyGroups = (ALL_SERVICE_KEYS as ServiceKey[]).filter((key) => {
    const svc = passport.services?.[key];
    return svc && (svc.claims ?? []).some((c) => !c.valid);
  });
  const allClaims: ActiveClaim[] = (Object.values(passport.services) as { claims: ActiveClaim[] }[]).flatMap((s) => s.claims ?? []);
  const selfIssuedCount = allClaims.filter((c) => c.issuer.toLowerCase() === passport.address.toLowerCase()).length;
  const allSelfIssued = allClaims.length > 0 && selfIssuedCount === allClaims.length;
  const revokedCount = allClaims.filter((c) => !c.valid && !c.validationFailed).length;
  const unverifiedCount = allClaims.filter((c) => !c.valid && c.validationFailed).length;
  const totalInvalid = revokedCount + unverifiedCount;
  return (
    <details style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)", background: "var(--color-surface-1)" }}>
      <summary className="t-sm" style={{ cursor: "pointer", fontWeight: 600 }}>
        {allSelfIssued
          ? `Self-issued test credentials (${allClaims.length} total)`
          : `History — ${revokedCount > 0 ? "revoked" : ""}${revokedCount > 0 && unverifiedCount > 0 ? " & " : ""}${unverifiedCount > 0 ? "unverified" : ""} (${totalInvalid} total)`}
      </summary>
      <div className="grid gap-6" style={{ marginTop: "var(--space-4)" }}>
        {historyGroups.map((key) => {
          const svc = passport.services[key];
          const claims = (svc.claims ?? []).filter((c) => !c.valid);
          if (claims.length === 0) return null;
          return (
            <section key={`history-${key}`} aria-label={`${SERVICE_LABELS[key]} history`}>
              <p className="eyebrow" style={{ marginBottom: "var(--space-2)", opacity: 0.7 }}>{SERVICE_LABELS[key].toUpperCase()} · {claims.length} {allSelfIssued ? "self-issued" : claims.some((c) => c.validationFailed) ? "unverified" : "revoked"}</p>
              <div className="grid gap-3" style={{ opacity: 0.85 }}>
                {claims.map((c) => (
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
        })}
      </div>
    </details>
  );
}

export function PassportCard({ passport, claimFields, onRequestProof, proofResult, proofLoading }: PassportCardProps) {
  const qrValue = `${window.location.origin}/passport/${passport.address}`;
  const name = passport.metadata?.name;

  const servicesWithClaims = (ALL_SERVICE_KEYS as ServiceKey[]).filter((key) => {
    const svc = passport.services?.[key];
    return svc && ((svc.claimCount ?? 0) > 0 || (svc.claims?.length ?? 0) > 0);
  });

  const verifiedServices = servicesWithClaims.filter((key) => {
    const svc = passport.services?.[key];
    return svc?.verified;
  });

  const credentialGroups = (ALL_SERVICE_KEYS as ServiceKey[]).filter((key) => {
    const svc = passport.services?.[key];
    return svc && (svc.claims?.length ?? 0) > 0;
  });
  const allClaims: ActiveClaim[] = (Object.values(passport.services) as { claims: ActiveClaim[] }[]).flatMap((s) => s.claims ?? []);
  const validClaimsAll = allClaims.filter((c) => c.valid);
  const revokedClaimsAll = allClaims.filter((c) => !c.valid && !c.validationFailed);
  const unverifiedClaimsAll = allClaims.filter((c) => !c.valid && c.validationFailed);
  const hasValid = validClaimsAll.length > 0;
  const hasRevoked = revokedClaimsAll.length > 0;
  const hasUnverified = unverifiedClaimsAll.length > 0;
  const hasInvalid = hasRevoked || hasUnverified;
  const selfIssuedCount = allClaims.filter((c) => c.issuer.toLowerCase() === passport.address.toLowerCase()).length;
  const allSelfIssued = allClaims.length > 0 && selfIssuedCount === allClaims.length;

  return (
    <div>
      {/* ---- Shareable cover card ---- */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <CoverCard passport={passport} />
        <div className="flex items-center gap-2" style={{ marginTop: "var(--space-3)" }}>
          <ShareButton passport={passport} />
          <a
            href={`https://testnet.arcscan.app/address/${passport.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--ghost btn--sm"
          >
            View on explorer ↗
          </a>
        </div>
      </div>

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
            {name ?? (passport.scanIncomplete ? "Identity registered" : "Unregistered identity")}
          </p>
          <p className="t-xs c-subtle" style={{ marginTop: 2 }}>
            Arc Testnet{passport.identityId > 0 ? ` · Identity token #${passport.identityId}` : passport.scanIncomplete ? " · On-chain registration confirmed" : ""}
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

        {/* Verification status — only shows verified when at least one service has valid claims */}
        {verifiedServices.length > 0 ? (
          <div className="verification-pulse" style={{ marginTop: "var(--space-3)" }}>
            <span className="verification-pulse__dot" aria-hidden="true" />
            <span>Passport verified — {verifiedServices.length} service{verifiedServices.length !== 1 ? "s" : ""} with valid attestations</span>
          </div>
        ) : allSelfIssued ? (
          <div className="verification-pulse" style={{ marginTop: "var(--space-3)", opacity: 0.5 }}>
            <span className="verification-pulse__dot" aria-hidden="true" />
            <span>Self-issued test credentials — get real attestations from authorized issuers</span>
          </div>
        ) : servicesWithClaims.length > 0 ? (
          <div className="verification-pulse" style={{ marginTop: "var(--space-3)", opacity: 0.6 }}>
            <span className="verification-pulse__dot" aria-hidden="true" />
            <span>No valid attestations — {servicesWithClaims.length} service{servicesWithClaims.length !== 1 ? "s" : ""} with {hasUnverified && !hasRevoked ? "unverified" : "revoked"} credentials</span>
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
            <div style={{ padding: "var(--space-8) var(--space-6)", textAlign: "center" }}>
              {/* Hero icon with gradient ring */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(0,229,160,0.15))",
                  border: "2px solid rgba(59,130,246,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto var(--space-5)",
                }}
              >
                <div style={{ color: "var(--color-arc-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><LogoMark size={32} /></div>
              </div>
              <p className="t-lg" style={{ fontWeight: 600, color: "var(--color-on-bright)", marginBottom: "var(--space-2)" }}>
                This passport is ready for its first credential
              </p>
              <p className="t-sm c-subtle" style={{ maxWidth: 340, margin: "0 auto", lineHeight: 1.6 }}>
                Verifiable credentials are issued by authorized issuers and committed on-chain.
                Once attested, they'll appear here — cryptographically verifiable by anyone.
              </p>
              <div className="verification-pulse" style={{ marginTop: "var(--space-5)" }}>
                <span className="verification-pulse__dot" aria-hidden="true" />
                <span>Waiting for first attestation</span>
              </div>
              <div style={{ marginTop: "var(--space-5)", display: "flex", justifyContent: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <a
                  href="#request-credential"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "10px 20px",
                    borderRadius: "var(--radius-md)",
                    background: "linear-gradient(135deg, var(--color-arc-primary), #2563EB)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "var(--text-sm)",
                    textDecoration: "none",
                    border: "none",
                    transition: "transform var(--duration-fast), box-shadow var(--duration-fast)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(59,130,246,0.4)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  Request a credential →
                </a>
                <a href="/verify" className="btn btn--ghost btn--sm">
                  Verify on-chain ↗
                </a>
              </div>
            </div>
          </section>
        ) : !hasValid ? (
          <>
            <section className="card" aria-label="Valid credentials" style={{ borderColor: allSelfIssued ? "rgba(99,102,241,0.3)" : "rgba(245,158,11,0.3)", background: allSelfIssued ? "rgba(99,102,241,0.04)" : "rgba(245,158,11,0.04)" }}>
              <div style={{ padding: "var(--space-8) var(--space-6)", textAlign: "center" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: allSelfIssued ? "rgba(99,102,241,0.1)" : "rgba(245,158,11,0.1)",
                    border: `2px solid ${allSelfIssued ? "rgba(99,102,241,0.2)" : "rgba(245,158,11,0.2)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto var(--space-4)",
                    fontSize: "1.5rem",
                  }}
                >
                  {allSelfIssued ? "🧪" : "🔄"}
                </div>
                <p className="t-lg" style={{ fontWeight: 600, color: "var(--color-on-bright)", marginBottom: "var(--space-2)" }}>
                  {allSelfIssued
                    ? "Self-issued test credentials"
                    : hasUnverified && !hasRevoked
                      ? "Credentials could not be verified"
                      : "Passport was reset"}
                </p>
                <p className="t-sm c-subtle" style={{ maxWidth: 380, margin: "0 auto", lineHeight: 1.6 }}>
                  {allSelfIssued
                    ? `This wallet has ${allClaims.length} attestation${allClaims.length !== 1 ? "s" : ""} that were issued by itself. These are test credentials from development — they don't contribute to your trust score.`
                    : hasUnverified && !hasRevoked
                      ? `On-chain verification was unavailable for ${unverifiedClaimsAll.length} credential${unverifiedClaimsAll.length !== 1 ? "s" : ""}. They may be valid — try refreshing.`
                      : `All ${revokedClaimsAll.length} previous credentials have been revoked. This passport needs fresh attestations to regain trust.`}
                </p>
                {!allSelfIssued && (
                  <div
                    style={{
                      marginTop: "var(--space-4)",
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(245,158,11,0.08)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span className="verification-pulse__dot" style={{ background: "var(--color-warn)" }} aria-hidden="true" />
                    <span className="t-xs" style={{ color: "var(--color-warn)", fontWeight: 500 }}>
                      {hasRevoked && `${revokedClaimsAll.length} revoked`}
                      {hasRevoked && hasUnverified && " · "}
                      {hasUnverified && `${unverifiedClaimsAll.length} unverified`}
                      {hasRevoked && " · rebuild to regain trust"}
                      {!hasRevoked && hasUnverified && " · try refreshing the page"}
                    </span>
                  </div>
                )}
                <div style={{ marginTop: "var(--space-5)", display: "flex", justifyContent: "center" }}>
                  {allSelfIssued ? (
                    <a
                      href="#request-credential"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        padding: "10px 20px",
                        borderRadius: "var(--radius-md)",
                        background: "linear-gradient(135deg, var(--color-arc-primary), #2563EB)",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "var(--text-sm)",
                        textDecoration: "none",
                        border: "none",
                      }}
                    >
                      Get real credentials →
                    </a>
                  ) : hasUnverified && !hasRevoked ? (
                    <button
                      onClick={() => window.location.reload()}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        padding: "10px 20px",
                        borderRadius: "var(--radius-md)",
                        background: "linear-gradient(135deg, var(--color-verified), #059669)",
                        color: "#04130D",
                        fontWeight: 600,
                        fontSize: "var(--text-sm)",
                        textDecoration: "none",
                        border: "none",
                        cursor: "pointer",
                        transition: "transform var(--duration-fast), box-shadow var(--duration-fast)",
                      }}
                    >
                      Refresh verification →
                    </button>
                  ) : (
                    <a
                      href="#request-credential"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        padding: "10px 20px",
                        borderRadius: "var(--radius-md)",
                        background: "linear-gradient(135deg, var(--color-verified), #059669)",
                        color: "#04130D",
                        fontWeight: 600,
                        fontSize: "var(--text-sm)",
                        textDecoration: "none",
                        border: "none",
                        transition: "transform var(--duration-fast), box-shadow var(--duration-fast)",
                      }}
                    >
                      Get verified →
                    </a>
                  )}
                </div>
              </div>
            </section>
            {hasInvalid && <HistorySection passport={passport} claimFields={claimFields} onRequestProof={onRequestProof} proofResult={proofResult} proofLoading={proofLoading} />}
          </>
        ) : (
          <>
            {credentialGroups.map((key) => {
              const svc = passport.services[key];
              const valid = (svc.claims ?? []).filter((c) => c.valid);
              if (valid.length === 0) return null;
              return (
                <section key={key} aria-label={SERVICE_LABELS[key]}>
                  <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-3)" }}>
                    <p className="eyebrow">{SERVICE_LABELS[key].toUpperCase()} · {valid.length} valid</p>
                    {(svc.claimCount ?? 0) > (svc.claims?.length ?? 0) && (
                      <span className="chip chip--muted">{svc.claimCount} on-chain</span>
                    )}
                  </div>
                  <div className="grid gap-3">
                    {valid.map((c) => (
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
            })}
            {hasInvalid && <HistorySection passport={passport} claimFields={claimFields} onRequestProof={onRequestProof} proofResult={proofResult} proofLoading={proofLoading} />}
          </>
        )}
      </div>
      </div>
    </div>
  );
}

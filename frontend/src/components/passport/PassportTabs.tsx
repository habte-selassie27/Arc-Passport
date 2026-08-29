import { useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { AddressDisplay } from "../ui/AddressDisplay";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import { ErrorState } from "../ui/ErrorState";
import { LogoMark } from "../ui/LogoMark";
import { CredentialCard } from "./CredentialCard";
import { ServiceBadge } from "./ServiceBadge";
import { CoverCard } from "./CoverCard";
import { ShareButton } from "./ShareButton";
import { TrustScoreDisplay, ReputationSignals, HistorySection } from "./PassportCard";
import { schemaNameForId } from "../../utils/schemaNames";
import { ALL_SERVICE_KEYS, SERVICE_LABELS, type PassportDocument, type ServiceKey, type ActiveClaim } from "../../types/passport";
import { useIdentityHistory } from "../../hooks/useIdentity";
import type { ClaimFieldClassification, FieldProof } from "../../hooks/useFieldProof";
import { NotificationsCard } from "../shared/NotificationsCard";
import { RequestCredentialForm } from "../forms/RequestCredentialForm";
import { DisclosureConfig } from "./DisclosureConfig";

// ---- Tab nav ----

type TabKey = "overview" | "credentials" | "activity" | "share";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "credentials", label: "Credentials" },
  { key: "activity", label: "Activity" },
  { key: "share", label: "Share" },
];

export function PassportTabNav({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <nav className="studio-tabs" aria-label="Passport sections" style={{ marginBottom: "var(--space-6)" }}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`studio-tabs__tab ${active === tab.key ? "studio-tabs__tab--active" : ""}`}
          aria-current={active === tab.key ? "page" : undefined}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

// ---- Overview ----

export function OverviewPanel({ passport }: { passport: PassportDocument }) {
  const qrValue = `${window.location.origin}/passport/${passport.address}`;
  const name = passport.metadata?.name;
  const servicesWithClaims = (ALL_SERVICE_KEYS as ServiceKey[]).filter((key) => {
    const svc = passport.services?.[key];
    return svc && ((svc.claimCount ?? 0) > 0 || (svc.claims?.length ?? 0) > 0);
  });
  const verifiedServices = servicesWithClaims.filter((key) => passport.services?.[key]?.verified);
  const allClaims: ActiveClaim[] = (Object.values(passport.services) as { claims: ActiveClaim[] }[]).flatMap((s) => s.claims ?? []);
  const selfIssuedCount = allClaims.filter((c) => c.issuer.toLowerCase() === passport.address.toLowerCase()).length;
  const allSelfIssued = allClaims.length > 0 && selfIssuedCount === allClaims.length;

  return (
    <div className="grid gap-6">
      {/* Identity card */}
      <section className="card" aria-label="Identity">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--color-surface-1)", color: "var(--color-subtle)", flexShrink: 0 }}
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
          <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard.writeText(passport.address)}>Copy address</Button>
        </div>
        {servicesWithClaims.length > 0 && (
          <div style={{ marginTop: "var(--space-5)" }}>
            <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Service coverage</p>
            <div className="flex flex-wrap gap-2">
              {servicesWithClaims.map((key) => {
                const svc = passport.services[key];
                return <ServiceBadge key={key} name={SERVICE_LABELS[key] ?? key} verified={svc.verified} claimCount={svc.claimCount} />;
              })}
            </div>
          </div>
        )}
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
            <span>No valid attestations — needs fresh attestations</span>
          </div>
        ) : (
          <div className="verification-pulse" style={{ marginTop: "var(--space-3)", opacity: 0.6 }}>
            <span className="verification-pulse__dot" aria-hidden="true" />
            <span>No attestations yet</span>
          </div>
        )}
      </section>

      <Card>
        <TrustScoreDisplay trustScore={passport.trustScore} />
      </Card>

      <Card>
        <ReputationSignals passport={passport} />
      </Card>

      {passport.onChainScore && (
        <Card>
          <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>On-chain score</p>
          <p className="mono t-xl" style={{ color: "var(--color-on-bright)", fontWeight: 700 }}>
            {passport.onChainScore.score}
            <span className="t-xs" style={{ marginLeft: "var(--space-2)", color: passport.onChainScore.isValid ? "var(--color-verified)" : "var(--color-warn)" }}>
              {passport.onChainScore.isValid ? "Valid" : "Expired"} {passport.onChainScore.isHuman ? "· Human" : ""}
            </span>
          </p>
          <p className="t-xs c-subtle" style={{ marginTop: "var(--space-1)" }}>
            {passport.onChainScore.computedAt > 0 && (
              <>Committed {new Date(passport.onChainScore.computedAt * 1000).toLocaleDateString()}</>
            )}
            {passport.onChainScore.computedAt > 0 && passport.onChainScore.expiresAt > 0 && " · "}
            {passport.onChainScore.expiresAt > 0 && (
              <>Expires {new Date(passport.onChainScore.expiresAt * 1000).toLocaleDateString()}</>
            )}
            {passport.onChainScore.computedAt === 0 && passport.onChainScore.expiresAt === 0 && (
              <span>Not yet computed</span>
            )}
          </p>
        </Card>
      )}
    </div>
  );
}

// ---- Credentials ----

export function CredentialsPanel({
  passport,
  claimFields,
  onRequestProof,
  proofResult,
  proofLoading,
  isOwner,
}: {
  passport: PassportDocument;
  claimFields?: Record<string, ClaimFieldClassification[]>;
  onRequestProof?: (claimId: string, fieldName: string) => void;
  proofResult?: FieldProof | null;
  proofLoading?: boolean;
  isOwner: boolean;
}) {
  const credentialGroups = (ALL_SERVICE_KEYS as ServiceKey[]).filter((key) => {
    const svc = passport.services?.[key];
    return svc && (svc.claims?.length ?? 0) > 0;
  });
  const allClaims: ActiveClaim[] = (Object.values(passport.services) as { claims: ActiveClaim[] }[]).flatMap((s) => s.claims ?? []);
  const hasValid = allClaims.some((c) => c.valid);

  return (
    <div className="grid gap-6">
      {credentialGroups.length === 0 ? (
        <Card>
          <EmptyState
            title="No credentials yet"
            body="This passport hasn't collected any credentials. Verifiable credentials are issued by authorized issuers and committed on-chain."
          />
          <div style={{ marginTop: "var(--space-4)", display: "flex", justifyContent: "center" }}>
            <Link to="/credentials" className="btn btn--primary btn--sm">Browse credentials →</Link>
          </div>
        </Card>
      ) : !hasValid ? (
        <>
          <Card style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.04)" }}>
            <p className="t-sm" style={{ fontWeight: 600 }}>No valid credentials</p>
            <p className="t-sm c-subtle" style={{ marginTop: "var(--space-1)" }}>This passport has credentials but none are currently valid (revoked or expired).</p>
          </Card>
          <HistorySection passport={passport} claimFields={claimFields} onRequestProof={onRequestProof} proofResult={proofResult} proofLoading={proofLoading} />
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
          {allClaims.some((c) => !c.valid) && (
            <HistorySection passport={passport} claimFields={claimFields} onRequestProof={onRequestProof} proofResult={proofResult} proofLoading={proofLoading} />
          )}
        </>
      )}

      {/* Add credentials CTA */}
      <Card>
        <p className="t-sm" style={{ fontWeight: 600 }}>Add more credentials</p>
        <p className="t-xs c-subtle" style={{ marginTop: "var(--space-1)" }}>Prove personhood, link Web2 accounts, verify Web2 data, or import external attestations.</p>
        <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Link to="/credentials" className="btn btn--ghost btn--sm">Browse credentials →</Link>
          <Link to="/verify" className="btn btn--ghost btn--sm">Verify on-chain ↗</Link>
        </div>
      </Card>

      {isOwner && (
        <>
          <NotificationsCard address={passport.address as `0x${string}`} />
          <RequestCredentialForm address={passport.address as `0x${string}`} />
          <DisclosureConfig
            claims={passport.claims?.map((c) => ({ claimId: c.claimId, schemaName: schemaNameForId(c.schemaId), issuer: c.issuer })) || []}
          />
        </>
      )}
    </div>
  );
}

// ---- Activity ----

const ARCSCAN_TOKEN = "https://testnet.arcscan.app/token";
const ARCSCAN_TX = "https://testnet.arcscan.app/tx";
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ActivityPanel({ address, passport }: { address: `0x${string}`; passport?: PassportDocument }) {
  const { data, isLoading, isError, error, refetch } = useIdentityHistory(address);

  const hasPassportClaims = passport && (() => {
    const all = (Object.values(passport.services) as { claims: ActiveClaim[] }[]).flatMap((s) => s.claims ?? []);
    return all.length > 0;
  })();

  return (
    <div className="grid gap-6">
      {/* Identity registrations */}
      <section>
        <h2 className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Identity registrations</h2>
        {isLoading && (
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifyContent: "center", padding: "var(--space-6)" }}>
              <Spinner size={16} />
              <span className="t-sm c-subtle">Scanning on-chain registrations…</span>
            </div>
          </Card>
        )}
        {isError && (
          <ErrorState title="Failed to load history" body={(error as Error)?.message} onRetry={() => refetch()} />
        )}
        {data && data.registrations.length === 0 && data.identity && (
          <Card verified>
            <div style={{ textAlign: "center", padding: "var(--space-4)" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>✓</div>
              <p className="t-sm" style={{ fontWeight: 600, color: "var(--color-verified)" }}>Identity registered</p>
              <p className="t-xs c-subtle">Token #{data.identity.tokenId}</p>
              <div style={{ marginTop: "var(--space-3)" }}>
                <a href={`${ARCSCAN_TOKEN}/${IDENTITY_REGISTRY}/${data.identity.tokenId}`} target="_blank" rel="noopener noreferrer" className="t-xs mono" style={{ color: "var(--color-arc-primary)" }}>
                  View token ↗
                </a>
              </div>
            </div>
          </Card>
        )}
        {data && data.registrations.length > 0 && (
          <div className="grid gap-3">
            {data.registrations.map((reg) => {
              const isActive = !reg.status || reg.status === "active";
              return (
                <Card key={reg.txHash + reg.tokenId} verified={isActive}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span style={{ fontSize: "1.2rem" }}>{isActive ? "✓" : reg.status === "burned" ? "✕" : "→"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="t-sm" style={{ fontWeight: 600 }}>{isActive ? "Identity registered" : reg.status === "transferred" ? "Transferred away" : "Burned"} · Token #{reg.tokenId}</p>
                      <p className="t-xs c-subtle">
                        {formatTimestamp(reg.timestamp)} {reg.blockNumber ? `· block ${reg.blockNumber}` : ""}
                      </p>
                    </div>
                  </div>
                  <div style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    {reg.txHash && (
                      <a href={`${ARCSCAN_TX}/${reg.txHash}`} target="_blank" rel="noopener noreferrer" className="t-xs mono" style={{ color: "var(--color-arc-primary)" }}>
                        Tx ↗
                      </a>
                    )}
                    <a href={`${ARCSCAN_TOKEN}/${IDENTITY_REGISTRY}/${reg.tokenId}`} target="_blank" rel="noopener noreferrer" className="t-xs mono" style={{ color: "var(--color-arc-primary)" }}>
                      Token ↗
                    </a>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {data && data.registrations.length === 0 && !data.identity && !data.partialScan && (
          <EmptyState title="No registration found" body={`No identity registered for ${address}.`} />
        )}
        {data?.partialScan && (
          <p className="t-xs c-subtle text-center" style={{ marginTop: "var(--space-2)" }}>Scan window limited by RPC — older registrations may not be listed.</p>
        )}
      </section>

      {/* Recent attestations as activity */}
      {hasPassportClaims && passport && (
        <section>
          <h2 className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Recent credentials</h2>
          <Card>
            <p className="t-xs c-subtle">
              {(Object.values(passport.services) as { claims: ActiveClaim[] }[]).flatMap((s) => s.claims ?? []).filter((c) => c.valid).length} valid credential{(Object.values(passport.services) as { claims: ActiveClaim[] }[]).flatMap((s) => s.claims ?? []).filter((c) => c.valid).length !== 1 ? "s" : ""} on this passport
            </p>
          </Card>
        </section>
      )}

      {!hasPassportClaims && !isLoading && (
        <Card>
          <EmptyState title="No activity yet" body="Activity appears when you register an identity or receive attestations." />
        </Card>
      )}
    </div>
  );
}

// ---- Share ----

export function SharePanel({ passport }: { passport: PassportDocument }) {
  const publicUrl = `${window.location.origin}/passport/${passport.address}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid gap-6">
      <CoverCard passport={passport} />
      <div className="flex items-center gap-2 flex-wrap">
        <ShareButton passport={passport} />
        <Button variant="ghost" size="sm" onClick={handleCopy}>{copied ? "Copied!" : "Copy link"}</Button>
        <a href={`https://testnet.arcscan.app/address/${passport.address}`} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">
          Explorer ↗
        </a>
      </div>

      <Card>
        <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Public link</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={publicUrl}
            className="input input--mono"
            style={{ flex: 1, minWidth: 0 }}
            onFocus={(e) => e.target.select()}
          />
          <Button size="sm" variant="ghost" onClick={handleCopy}>{copied ? "✓" : "Copy"}</Button>
        </div>
        <div style={{ marginTop: "var(--space-3)", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--color-border)", width: 128, height: 128, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <QRCodeSVG value={publicUrl} size={120} level="M" />
        </div>
        <p className="t-xs c-subtle" style={{ marginTop: "var(--space-2)" }}>Anyone with this link can view your public passport and verify attestations on-chain.</p>
      </Card>
    </div>
  );
}

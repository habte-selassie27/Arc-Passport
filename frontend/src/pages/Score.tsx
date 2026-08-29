import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount, useSignMessage } from "wagmi";
import { usePassport } from "../hooks/usePassport";
import { useOnChainScore, useHumanityThreshold } from "../hooks/useScore";
import { useScoreHistory } from "../hooks/useScoreHistory";
import { useWallet } from "../contexts/WalletContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { CardSkeleton } from "../components/ui/Skeleton";
import { ScoreDisplay } from "../components/passport/ScoreDisplay";
import { ScoreHistoryChart } from "../components/passport/ScoreHistoryChart";
import { LogoMark } from "../components/ui/LogoMark";
import { SERVICE_LABELS, type ServiceKey } from "../types/passport";
import { apiUrl } from "../config/api";
import { signedFetch } from "../utils/signedApi";

function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export function ScorePage() {
  const { address: paramAddress } = useParams<{ address: string }>();
  const { address: connectedAddress } = useWallet();
  const navigate = useNavigate();
  const targetAddress = (paramAddress || connectedAddress) as `0x${string}` | undefined;

  if (!targetAddress) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Humanity Score"
          title="On-chain Score"
          description="Check any address's on-chain humanity score. Scores are computed from verifiable attestations and committed on-chain for transparent, auditable verification."
        />
        <Card>
          <ScoreEntry onNavigate={(addr) => navigate(`/score/${addr}`)} />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Humanity Score"
        title={`${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`}
        description="On-chain humanity score computed from verifiable attestations."
        align="left"
      />
      <ScoreDetail address={targetAddress} />
    </div>
  );
}

function ScoreDetail({ address }: { address: `0x${string}` }) {
  const { score: onChainScore, isLoading: scoreLoading } = useOnChainScore(address);
  const { data: passport, isLoading: passportLoading, error: passportError, refetch } = usePassport(address);
  const { data: threshold } = useHumanityThreshold();
  const { isConnected, address: connectedAddress } = useWallet();
  const { address: walletAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const isLoading = scoreLoading || passportLoading;
  const isOwner = isConnected && connectedAddress?.toLowerCase() === address.toLowerCase();

  // Score computation state
  const [computing, setComputing] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [computeSuccess, setComputeSuccess] = useState(false);

  // On-chain commit state
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = useState(false);

  const handleComputeScore = useCallback(async () => {
    setComputing(true);
    setComputeError(null);
    setComputeSuccess(false);
    try {
      const result = await signedFetch<{ score: number }>({
        path: `/score/${address}`,
        address: walletAddress!,
        signMessage: signMessageAsync,
      });
      setComputeSuccess(true);
      refetch();
    } catch (err) {
      setComputeError((err as Error).message);
    } finally {
      setComputing(false);
    }
  }, [address, walletAddress, signMessageAsync, refetch]);

  const handleCommitOnChain = useCallback(async () => {
    if (!onChainScore) return;
    setCommitting(true);
    setCommitError(null);
    setCommitSuccess(false);
    try {
      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
      await signedFetch({
        path: "/score/commit",
        address: walletAddress!,
        signMessage: signMessageAsync,
        method: "POST",
        body: {
          subject: address,
          scorerId: 0,
          score: onChainScore.score,
          expiresAt,
          dataCommitment: "0x0000000000000000000000000000000000000000000000000000000000000000",
        },
      });
      setCommitSuccess(true);
    } catch (err) {
      setCommitError((err as Error).message);
    } finally {
      setCommitting(false);
    }
  }, [address, walletAddress, signMessageAsync, onChainScore]);

  return (
    <div className="grid gap-6">
      {/* Score hero card */}
      <Card>
        {isLoading && <CardSkeleton />}

        {!isLoading && !onChainScore && (
          <div className="empty">
            <LogoMark size={32} className="empty__icon" />
            <p className="empty__title">No score yet</p>
            <p className="empty__body">
              This address does not have an on-chain humanity score. Compute a score from
              verifiable attestations or commit one on-chain.
            </p>
            <div className="empty__action" style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)", justifyContent: "center" }}>
              <Button
                size="sm"
                loading={computing}
                disabled={computing}
                onClick={handleComputeScore}
              >
                Compute Score
              </Button>
              <a href={`/passport/${address}`} className="btn btn--ghost btn--sm">
                View Passport
              </a>
            </div>
            {computeError && (
              <p className="t-xs" style={{ color: "var(--color-danger)", marginTop: "var(--space-2)" }}>
                {computeError}
              </p>
            )}
          </div>
        )}

        {!isLoading && onChainScore && (
          <div>
            <ScoreDisplay score={onChainScore} variant="detailed" />
            {/* Action buttons */}
            <div className="flex gap-2" style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
              <Button
                size="sm"
                variant="ghost"
                loading={computing}
                disabled={computing}
                onClick={handleComputeScore}
              >
                Refresh Score
              </Button>
              {isOwner && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={committing}
                  disabled={committing || !onChainScore.isValid}
                  onClick={handleCommitOnChain}
                >
                  Commit On-Chain
                </Button>
              )}
            </div>
            {computeError && (
              <p className="t-xs" style={{ color: "var(--color-danger)", marginTop: "var(--space-2)" }}>
                {computeError}
              </p>
            )}
            {computeSuccess && (
              <p className="t-xs" style={{ color: "var(--color-verified)", marginTop: "var(--space-2)" }}>
                Score refreshed successfully.
              </p>
            )}
            {commitError && (
              <p className="t-xs" style={{ color: "var(--color-danger)", marginTop: "var(--space-2)" }}>
                {commitError}
              </p>
            )}
            {commitSuccess && (
              <p className="t-xs" style={{ color: "var(--color-verified)", marginTop: "var(--space-2)" }}>
                Score committed on-chain.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Score history chart */}
      {!isLoading && <ScoreHistoryCard address={address} />}

      {/* Trust score breakdown (off-chain computed) */}
      {!isLoading && !passportError && passport?.trustScore && (
        <Card>
          <TrustScoreDetail passport={passport} />
        </Card>
      )}

      {/* Score explanation */}
      {!isLoading && (
        <Card>
          <ScoreExplanation />
        </Card>
      )}

      {/* Attestation coverage */}
      {!isLoading && !passportError && passport && (
        <Card>
          <AttestationCoverage passport={passport} />
        </Card>
      )}

      {/* Verification status */}
      {!isLoading && !passportError && passport && (
        <Card>
          <VerificationStatus passport={passport} />
        </Card>
      )}

      {passportError && (
        <ErrorBanner onRetry={() => void refetch()}>
          Passport data unavailable — backend offline. On-chain score is still valid.
        </ErrorBanner>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <a href={`/passport/${address}`} className="btn btn--ghost btn--sm">
          View Passport
        </a>
        <a
          href={`https://testnet.arcscan.app/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--ghost btn--sm"
        >
          Explorer ↗
        </a>
      </div>
    </div>
  );
}

function TrustScoreDetail({ passport }: { passport: any }) {
  const ts = passport.trustScore;
  const scoreColor = ts.passed ? "var(--color-verified)" : "var(--color-warning)";
  const activeCategories = ts.categories.filter((c: any) => c.claimCount > 0);

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>
        Trust Score Breakdown
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <span className="mono t-3xl" style={{ color: scoreColor, fontWeight: 700 }}>
          {ts.score}
        </span>
        <span className="t-xs c-subtle">/ {ts.threshold} threshold</span>
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
            width: `${Math.min((ts.score / 100) * 100, 100)}%`,
            height: "100%",
            background: scoreColor,
            borderRadius: 3,
          }}
        />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4" style={{ marginTop: "var(--space-4)" }}>
        <StatBox label="Attestations" value={ts.totalClaims} />
        <StatBox label="Unique Issuers" value={ts.totalIssuers} />
        <StatBox label="Categories" value={`${ts.activeCategories.length}/${ts.categories.length}`} />
      </div>

      {/* Per-category breakdown */}
      {activeCategories.length > 0 && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>Category breakdown</p>
          <div className="grid gap-2">
            {activeCategories.map((cat: any) => (
              <div
                key={cat.service}
                className="flex items-center justify-between"
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface-1)",
                }}
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon service={cat.service} />
                  <span className="t-sm">{cat.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="mono t-xs c-subtle">
                    {cat.claimCount} claim{cat.claimCount !== 1 ? "s" : ""}
                  </span>
                  <span className="mono t-sm" style={{ color: "var(--color-on-bright)" }}>
                    {cat.score.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreExplanation() {
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>
        How Scores Work
      </p>
      <div className="grid gap-3">
        <ExplanationRow
          icon="1"
          title="Attestations are issued"
          description="Authorized issuers issue verifiable credentials (attestations) to your wallet on-chain. Each attestation commits a Merkle root of the claim data."
        />
        <ExplanationRow
          icon="2"
          title="Score is computed"
          description="A weighted algorithm evaluates your attestations across10 categories (Identity, KYC, Credentials, DAO, Reputation, Employment, Education, Social, Custom, ZK Passport). Each category has a weight reflecting its trust signal strength."
        />
        <ExplanationRow
          icon="3"
          title="Score is committed on-chain"
          description="The computed score is committed to the ScoreRegistry contract on-chain, creating a transparent, auditable record. Scores expire after30 days and need recomputation."
        />
        <ExplanationRow
          icon="4"
          title="Apps verify your score"
          description="Decentralized apps query your on-chain score to gate access, votes, or airdrops. A score above the threshold (default: 20) indicates a verified human."
        />
      </div>
      <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", borderRadius: "var(--radius-sm)", background: "var(--color-surface-1)" }}>
        <p className="t-xs c-subtle">
          <strong>Category weights:</strong> Identity (1.0), KYC (1.0), Credentials (0.8), Reputation (0.7), Employment (0.7), DAO (0.6), Education (0.5), Social (0.4), Custom (0.3), ZK Passport (0.9).
          Schema bonuses apply for government ID, liveness, and KYC attestations.
        </p>
      </div>
    </div>
  );
}

function ExplanationRow({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex gap-3" style={{ padding: "var(--space-2) 0" }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--color-surface-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span className="mono t-xs" style={{ color: "var(--color-verified)" }}>{icon}</span>
      </div>
      <div>
        <p className="t-sm" style={{ fontWeight: 600 }}>{title}</p>
        <p className="t-xs c-subtle" style={{ marginTop: 2 }}>{description}</p>
      </div>
    </div>
  );
}

function AttestationCoverage({ passport }: { passport: any }) {
  const allClaims = Object.values(passport.services as Record<string, any>).flatMap(
    (s: any) => s.claims ?? []
  );
  const validClaims = allClaims.filter((c: any) => c.valid);
  const allIssuers = new Set(allClaims.map((c: any) => c.issuer.toLowerCase())).size;
  const validIssuers = new Set(validClaims.map((c: any) => c.issuer.toLowerCase())).size;
  const servicesWithClaims = Object.keys(passport.services).filter(
    (k: string) => (passport.services[k]?.claimCount ?? 0) > 0
  ).length;

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>
        Attestation Coverage
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <DataRow label="Total attestations" value={allClaims.length} />
        <DataRow label="Valid attestations" value={validClaims.length} color="var(--color-verified)" />
        <DataRow label="Unique issuers (all)" value={allIssuers} />
        <DataRow label="Unique issuers (valid)" value={validIssuers} color="var(--color-verified)" />
        <DataRow label="Services covered" value={servicesWithClaims} />
        <DataRow label="Revoked" value={allClaims.length - validClaims.length} color="var(--color-danger)" />
      </div>
    </div>
  );
}

function VerificationStatus({ passport }: { passport: any }) {
  const services = Object.entries(passport.services as Record<string, any>)
    .filter(([_, s]: [string, any]) => (s.claimCount ?? 0) > 0)
    .map(([key, s]: [string, any]) => ({
      key: key as ServiceKey,
      label: SERVICE_LABELS[key as ServiceKey] ?? key,
      verified: s.verified,
      claimCount: s.claimCount,
      validCount: (s.claims ?? []).filter((c: any) => c.valid).length,
    }));

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>
        Verification Status
      </p>
      {services.length === 0 ? (
        <p className="t-sm c-subtle">No attestations to verify.</p>
      ) : (
        <div className="grid gap-2">
          {services.map((svc) => (
            <div
              key={svc.key}
              className="flex items-center justify-between"
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface-1)",
              }}
            >
              <div className="flex items-center gap-2">
                <CategoryIcon service={svc.key} />
                <span className="t-sm">{svc.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="mono t-xs c-subtle">
                  {svc.validCount}/{svc.claimCount}
                </span>
                <span
                  className="chip"
                  style={{
                    background: svc.verified ? "rgba(0,229,160,0.15)" : "rgba(245,158,11,0.15)",
                    color: svc.verified ? "var(--color-verified)" : "var(--color-warning)",
                    fontSize: "0.7rem",
                  }}
                >
                  {svc.verified ? "VALID" : "NO VALID CLAIMS"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Score history chart card ──

function ScoreHistoryCard({ address }: { address: `0x${string}` }) {
  const { data: history, isLoading } = useScoreHistory(address, { limit: 50 });

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: "var(--space-1)" }}>
            Score History
          </p>
          <p className="t-xs c-subtle">
            {history && history.length > 0
              ? `${history.length} computation${history.length !== 1 ? "s" : ""} recorded`
              : "No history yet"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="shimmer" style={{ width: "80%", height: 120, borderRadius: "var(--radius-sm)" }} />
        </div>
      ) : history && history.length > 0 ? (
        <ScoreHistoryChart entries={history} />
      ) : (
        <div style={{ textAlign: "center", padding: "var(--space-6)" }}>
          <p className="t-sm c-subtle">No score history yet.</p>
          <p className="t-xs c-subtle" style={{ marginTop: "var(--space-1)" }}>
            Scores appear here after computation or on-chain commitment.
          </p>
        </div>
      )}
    </Card>
  );
}

// ── Shared sub-components ──

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        padding: "var(--space-3)",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-surface-1)",
        textAlign: "center",
      }}
    >
      <p className="mono t-lg" style={{ color: "var(--color-on-bright)" }}>{value}</p>
      <p className="t-xs c-subtle">{label}</p>
    </div>
  );
}

function DataRow({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="flex justify-between items-center" style={{ padding: "var(--space-1) 0" }}>
      <span className="t-sm c-subtle">{label}</span>
      <span className="mono t-sm" style={{ color: color ?? "var(--color-on-bright)" }}>
        {value}
      </span>
    </div>
  );
}

function CategoryIcon({ service }: { service: ServiceKey }) {
  const icons: Record<ServiceKey, string> = {
    identity: "ID",
    kyc: "KYC",
    credentials: "CR",
    dao: "DAO",
    reputation: "RP",
    employment: "EM",
    education: "ED",
    social: "SC",
    custom: "CU",
    zkPassport: "ZK",
  };
  return (
    <span
      aria-hidden="true"
      className="mono t-xs"
      style={{
        fontSize: "0.6rem",
        fontWeight: 700,
        color: "var(--color-subtle)",
        background: "var(--color-surface-1)",
        padding: "2px 4px",
        borderRadius: 3,
      }}
    >
      {icons[service] ?? "??"}
    </span>
  );
}

function ScoreEntry({ onNavigate }: { onNavigate: (address: string) => void }) {
  const [value, setValue] = useState("");
  const valid = isValidAddress(value);

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onNavigate(value);
      }}
    >
      <Input
        mono
        type="text"
        placeholder="0x... enter an address to check score"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Wallet address"
      />
      <Button type="submit" disabled={!valid}>
        Check Score
      </Button>
    </form>
  );
}

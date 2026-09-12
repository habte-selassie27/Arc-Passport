import { useState } from "react";
import { useAccount } from "wagmi";
import { useAavConfig, useAavStatus, useAavVerify, type AavResult, type AavSource, type AavConfidence } from "../hooks/useAAV";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { PageHeader } from "../components/ui/PageHeader";
import { AddressDisplay } from "../components/ui/AddressDisplay";

const SOURCE_META: Record<AavSource, { icon: string; label: string; blurb: string }> = {
  arcHouse: { icon: "🏠", label: "Arc House", blurb: "Points, tier, roles, hackathons, bootcamps, events" },
  github: { icon: "🧑‍💻", label: "GitHub", blurb: "Arc-related repositories, commits and activity" },
  arcChain: { icon: "⛓️", label: "Arc Wallet", blurb: "Transactions, contract deployments, on-chain activity" },
};

const CONFIDENCE_META: Record<AavConfidence, { dot: string; label: string; color: string }> = {
  VERIFIED: { dot: "🟢", label: "Verified", color: "var(--color-success, #22c55e)" },
  PARTIALLY_VERIFIED: { dot: "🟡", label: "Partially Verified", color: "#eab308" },
  EVIDENCE_FOUND: { dot: "🟠", label: "Evidence Found", color: "#f97316" },
  UNVERIFIED: { dot: "🔴", label: "Unverified", color: "#ef4444" },
};

function ScoreDial({ score, confidence }: { score: number; confidence: AavConfidence }) {
  const meta = CONFIDENCE_META[confidence];
  return (
    <Card className="aav-score-card">
      <div className="text-center">
        <p className="t-xs c-muted" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Ecosystem Trust
        </p>
        <p className="display t-3xl mono" style={{ margin: "var(--space-2) 0" }}>
          {score}
          <span className="t-lg c-muted">/100</span>
        </p>
        <p className="t-sm" style={{ color: meta.color }}>
          {meta.dot} Confidence: <strong>{meta.label}</strong>
        </p>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "var(--color-border)",
            marginTop: "var(--space-4)",
            overflow: "hidden",
          }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div style={{ width: `${score}%`, height: "100%", background: meta.color, transition: "width .6s ease" }} />
        </div>
      </div>
    </Card>
  );
}

function SourceCard({ source, result }: { source: AavSource; result: AavResult | null }) {
  const [open, setOpen] = useState(false);
  const meta = SOURCE_META[source];
  const state = result?.sources[source];
  const items = (result?.evidence ?? []).filter((e) => e.source === source);

  const status = !state
    ? "NOT CHECKED"
    : !state.configured
      ? "NOT CONFIGURED"
      : !state.connected
        ? "UNAVAILABLE"
        : items.length > 0
          ? "VERIFIED ✓"
          : "NO EVIDENCE";

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
        aria-expanded={open}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
          <div>
            <p className="t-md" style={{ margin: 0 }}>
              {meta.icon} <strong>{meta.label}</strong>
            </p>
            <p className="t-xs c-muted" style={{ margin: "var(--space-1) 0 0" }}>
              {meta.blurb}
            </p>
          </div>
          <span className="mono t-xs">{status}</span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--color-border)", marginTop: "var(--space-3)", paddingTop: "var(--space-3)" }}>
          {items.length === 0 ? (
            <p className="t-xs c-muted" style={{ margin: 0 }}>
              {state?.error ? `Source error: ${state.error}` : "No evidence collected from this source yet."}
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
              {items.map((e, i) => (
                <li key={`${e.kind}-${i}`} className="t-sm" style={{ marginBottom: "var(--space-1)" }}>
                  {e.label}
                  {e.detail ? <span className="c-muted"> — {e.detail}</span> : null}
                  <span className="c-muted t-xs mono"> · w={e.weight.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export function AAVPage() {
  const { address, isConnected } = useAccount();
  const { data: config } = useAavConfig();
  const { data: status, isLoading: statusLoading } = useAavStatus(address);
  const verify = useAavVerify();

  const [githubUsername, setGithubUsername] = useState("");
  const [arcHouseHandle, setArcHouseHandle] = useState("");

  if (!isConnected) {
    return (
      <div className="text-center" style={{ padding: "var(--space-6)" }}>
        <p className="display t-lg" style={{ marginBottom: "var(--space-2)" }}>
          Connect your wallet
        </p>
        <p className="t-sm c-muted" style={{ maxWidth: 420, margin: "0 auto" }}>
          Connect a wallet to verify your Arc ecosystem activity across Arc House,
          GitHub and the Arc chain.
        </p>
      </div>
    );
  }

  const result = status?.result ?? null;
  const hasAnyInput = githubUsername.trim().length > 0 || arcHouseHandle.trim().length > 0;

  const handleVerify = () => {
    if (!address) return;
    verify.mutate({
      address,
      githubUsername: githubUsername.trim() || undefined,
      arcHouseHandle: arcHouseHandle.trim() || undefined,
    });
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Arc Activity Verification"
        title="Arc Activity"
        description="Correlate your Arc House contributions, GitHub work and on-chain activity into one evidence-backed trust signal. Every source is checked independently — nothing is taken on faith."
      />

      {result && (
        <div style={{ marginBottom: "var(--space-5)" }}>
          <ScoreDial score={result.score} confidence={result.confidence} />
          <div style={{ marginTop: "var(--space-3)" }}>
            <AddressDisplay address={result.address as `0x${string}`} />
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        {(Object.keys(SOURCE_META) as AavSource[])
          .filter((source) => source !== "arcHouse" || config?.arcHouse?.configured)
          .map((source) => (
            <SourceCard key={source} source={source} result={result} />
          ))}
      </div>

      {result && result.correlations.length > 0 && (
        <Card verified className="aav-correlations" style={{ marginBottom: "var(--space-5)" }}>
          <p className="t-sm" style={{ marginTop: 0 }}>
            <strong>Cross-source consistency</strong>
          </p>
          <ul style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
            {result.correlations.map((c) => (
              <li key={c.kind} className="t-sm">
                ✓ {c.label}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <p className="t-sm" style={{ marginTop: 0 }}>
          <strong>Link sources</strong>
        </p>
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <label className="t-sm" style={{ display: "grid", gap: 4 }}>
            GitHub username
            <input
              className="input"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              placeholder="e.g. vitalik"
              autoComplete="off"
            />
          </label>
          {config?.arcHouse?.configured && (
            <label className="t-sm" style={{ display: "grid", gap: 4 }}>
              Arc House handle
              <input
                className="input"
                value={arcHouseHandle}
                onChange={(e) => setArcHouseHandle(e.target.value)}
                placeholder="your Arc House username"
                autoComplete="off"
              />
            </label>
          )}
        </div>
        <div style={{ marginTop: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Button onClick={handleVerify} loading={verify.isPending} disabled={!hasAnyInput && !!result}>
            {result ? "Re-verify" : "Verify my Arc activity"}
          </Button>
          {verify.isPending && <Spinner />}
        </div>
        {!hasAnyInput && !result && (
          <p className="t-xs c-muted" style={{ marginTop: "var(--space-2)", marginBottom: 0 }}>
            Enter at least one handle to start. Your wallet is checked on-chain automatically.
          </p>
        )}
      </Card>

      {verify.error && <ErrorBanner>{(verify.error as Error).message}</ErrorBanner>}

      {statusLoading && (
        <div className="text-center">
          <Spinner />
        </div>
      )}
    </div>
  );
}

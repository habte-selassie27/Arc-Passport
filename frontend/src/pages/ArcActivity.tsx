/**
 * ArcActivity — AAV v2 Trust & Activity dashboard (see AAV.md §18).
 * Additive — existing /aav page is untouched.
 * Public summary works without a wallet; dashboard + attest need signing.
 */
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { AddressDisplay } from "../components/ui/AddressDisplay";
import { ConfidenceBar } from "../components/AAV/ConfidenceBar";
import { EvidenceSourceRow } from "../components/AAV/EvidenceSourceRow";
import { CrossSourceBadge } from "../components/AAV/CrossSourceBadge";
import { MissingEvidenceList } from "../components/AAV/MissingEvidenceList";
import { EducationBadgeVerifier } from "../components/AAV/EducationBadgeVerifier";
import { DAOScanner } from "../components/AAV/DAOScanner";
import { QuestProgress, buildQuestItems } from "../components/AAV/QuestProgress";
import { getStoredBadgeUrls } from "../hooks/useCredentialBadges";
import { usePassport } from "../hooks/usePassport";
import { useStartGithubLink } from "../hooks/useGitHubOAuth";
import { useStartLinkedinLink } from "../hooks/useLinkedInOAuth";
import {
  useAavV2Attest,
  useAavV2Dashboard,
  useAavV2LinkStatus,
  useAavV2Missing,
  useAavV2Refresh,
  useAavV2Schemas,
  useAavV2Summary,
} from "../hooks/useAAVv2";

const EXPLORER = "https://testnet.arcscan.app";

export function ArcActivityPage() {
  const { address: wallet } = useAccount();
  const { address: paramAddress } = useParams<{ address: string }>();
  const address = (paramAddress ?? wallet) as `0x${string}` | undefined;
  const isOwn = !!wallet && !!address && wallet.toLowerCase() === address.toLowerCase();

  const [githubUsername, setGithubUsername] = useState("");
  const [arcHouseHandle, setArcHouseHandle] = useState("");
  const [badgeUrls, setBadgeUrls] = useState<string[]>(getStoredBadgeUrls);
  const [projectUri, setProjectUri] = useState("");
  const [deployment, setDeployment] = useState("");
  const [selectedSchema, setSelectedSchema] = useState<string>("");
  const [attestResult, setAttestResult] = useState<{ txHash: string; schemaId: string } | null>(null);

  const linkStatusPre = useAavV2LinkStatus(address, {});
  const storedGithub = linkStatusPre.data?.github.username ?? null;
  const storedLinkedin = linkStatusPre.data?.linkedin?.name ?? null;
  const startLinkedinLink = useStartLinkedinLink();
  const effectiveGithub = githubUsername.trim() || storedGithub || undefined;

  const handles = {
    githubUsername: effectiveGithub,
    arcHouseHandle: arcHouseHandle.trim() || undefined,
    badgeUrls: badgeUrls.length > 0 ? badgeUrls : undefined,
  };
  const startGithubLink = useStartGithubLink();

  const summary = useAavV2Summary(address, handles);
  const missing = useAavV2Missing(address, handles);
  const linkStatus = useAavV2LinkStatus(address, handles);
  const dashboard = useAavV2Dashboard(isOwn ? address : undefined, handles);
  const schemas = useAavV2Schemas();
  const refresh = useAavV2Refresh();
  const attest = useAavV2Attest();

  const data = dashboard.data;
  const s = summary.data;
  const { data: passport } = usePassport(address);
  const questItems = buildQuestItems(passport?.trustScore.categories);

  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    // Defer past first paint so async cards have mounted.
    const t = setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => clearTimeout(t);
  }, [hash]);

  const handleRefresh = () => {
    if (!address) return;
    setBadgeUrls(getStoredBadgeUrls());
    refresh.mutate({ address, ...handles, badgeUrls: getStoredBadgeUrls() });
  };

  const handleAttest = () => {
    if (!address || !selectedSchema) return;
    setAttestResult(null);
    attest.mutate(
      { address, schemaId: selectedSchema, ...handles, projectUri: projectUri.trim() || undefined, deployment: deployment.trim() || undefined },
      { onSuccess: (d) => setAttestResult({ txHash: d.txHash, schemaId: d.schemaId }) },
    );
  };

  const handleEvidenceChange = () => {
    setBadgeUrls(getStoredBadgeUrls());
  };

  if (!address) {
    return (
      <div className="text-center" style={{ padding: "var(--space-6)" }}>
        <p className="display t-lg" style={{ marginBottom: "var(--space-2)" }}>
          Connect your wallet
        </p>
        <p className="t-sm c-muted" style={{ maxWidth: 440, margin: "0 auto" }}>
          Connect a wallet to see your Arc trust &amp; activity — or open a public
          profile at <span className="mono">/arc-activity/0x…</span>.
        </p>
      </div>
    );
  }

  const liveSchemas: { id: string; name: string }[] = ((schemas.data?.schemas ?? []) as { id: string; name: string }[])
    .filter((sc) => ["arcpass_arc_house_architect", "arcpass_arc_builder", "arcpass_arc_project"].includes(sc.name));

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Trust & Activity · AAV v2"
        title="Trust & Activity"
        description={linkStatus.data?.arcHouse.configured === false
          ? "Evidence from GitHub and the Arc chain — correlated into one confidence-graded trust signal. A single source never produces VERIFIED status."
          : "Evidence from Arc House, GitHub and the Arc chain — correlated into one confidence-graded trust signal. A single source never produces VERIFIED status."}
      />

      <div style={{ marginBottom: "var(--space-3)" }}>
        <AddressDisplay address={address} />
      </div>

      {summary.isLoading ? (
        <div className="text-center"><Spinner /></div>
      ) : summary.error ? (
        <ErrorBanner>{(summary.error as Error).message}</ErrorBanner>
      ) : s ? (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Overall trust score</p>
          <ConfidenceBar score={data?.overallConfidence ?? s.overallConfidence} level={data?.confidenceLevel ?? s.confidenceLevel} />
          <p className="t-xs c-subtle" style={{ marginBottom: 0 }}>
            Source coverage: {data?.sourcesConnected ?? "—"} connected · {s.canAttest ? "eligible for attestation ✓" : "below attestation threshold (60%)"}
          </p>
        </Card>
      ) : null}

      {/* Trust Score Quest — every category actionable */}
      <Card style={{ marginBottom: "var(--space-5)" }}>
        <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Trust Score Quest</p>
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-3)" }}>
          Points are earned when authorized issuers attest credentials to this address.
          Each row shows its max contribution — and exactly how to earn it.
        </p>
        <QuestProgress items={questItems} withActions={isOwn} variant="full" />
      </Card>

      {/* Sources */}
      <div style={{ display: "grid", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        {linkStatus.data?.arcHouse.configured !== false && (
          <EvidenceSourceRow
            icon="🏠"
            label="Arc House"
            blurb="Points, tier, roles, hackathons, bootcamps, events — reputation evidence only, no monetary value"
            level={linkStatus.data?.arcHouse.linked ? "EVIDENCE_FOUND" : "NOT_LINKED"}
            summary={linkStatus.data?.arcHouse.linked ? "Arc House account linked" : "Enter your Arc House handle below to check"}
            loading={linkStatus.isLoading}
            error={linkStatus.error ? (linkStatus.error as Error).message : null}
            onRetry={() => linkStatus.refetch()}
          />
        )}
        <EvidenceSourceRow
          icon="🧑‍💻"
          label="GitHub"
          blurb="Arc-related repositories, commit quality, merged PRs — quality weighted, not raw counts"
          level={linkStatus.data?.github.linked ? "EVIDENCE_FOUND" : "NOT_LINKED"}
          summary={linkStatus.data?.github.linked ? "GitHub activity found" : "Enter your GitHub username below to check"}
          loading={linkStatus.isLoading}
          error={linkStatus.error ? (linkStatus.error as Error).message : null}
          onRetry={() => linkStatus.refetch()}
        />
        <EvidenceSourceRow
          icon="⛓️"
          label="Arc Wallet"
          blurb="Transactions, contract deployments, on-chain activity — checked automatically"
          level={linkStatus.data?.arcChain.linked ? "EVIDENCE_FOUND" : "NOT_LINKED"}
          summary={linkStatus.data?.arcChain.linked ? "On-chain activity found" : "No on-chain activity detected for this wallet yet"}
          loading={linkStatus.isLoading}
          error={linkStatus.error ? (linkStatus.error as Error).message : null}
          onRetry={() => linkStatus.refetch()}
        />
      </div>

      {/* Cross-source matches */}
      {s && s.crossMatches.length > 0 && (
        <Card verified style={{ marginBottom: "var(--space-5)" }}>
          <p className="t-sm" style={{ marginTop: 0 }}><strong>Cross-source consistency</strong></p>
          <ul style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
            {s.crossMatches.map((c) => (
              <CrossSourceBadge key={c.claim} claim={c.claim} confirmedBy={c.confirmedBy} bonusPoints={c.bonusPoints} />
            ))}
          </ul>
        </Card>
      )}

      {/* Verticals */}
      {data && data.verticals.length > 0 && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Credentials earned</p>
          <ul style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
            {data.verticals.map((v) => (
              <li key={v.vertical} className="t-sm" style={{ marginBottom: "var(--space-1)" }}>
                <span className="mono">{v.vertical}</span> — {v.confidenceLevel.replace(/_/g, " ")} ({v.overallConfidence}%){" "}
                {v.canAttest ? "· attestable ✓" : "· not yet attestable"}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Link sources + refresh */}
      <Card style={{ marginBottom: "var(--space-5)" }}>
        <p className="t-sm" style={{ marginTop: 0 }}><strong>Link sources</strong></p>
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <div>
            <label className="t-sm" style={{ display: "grid", gap: 4 }}>
              GitHub username
              <input className="input" value={githubUsername} onChange={(e) => setGithubUsername(e.target.value)} placeholder={storedGithub ? `@${storedGithub} (connected)` : "e.g. octocat"} autoComplete="off" />
            </label>
            {isOwn && !storedGithub && linkStatusPre.data?.github.oauthConfigured && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <Button onClick={() => startGithubLink.mutate()} loading={startGithubLink.isPending}>
                  Connect GitHub via OAuth
                </Button>
                <p className="t-xs c-subtle" style={{ marginTop: "var(--space-1)", marginBottom: 0 }}>
                  Proves you control the account and auto-reads your Arc repos, merged PRs, and deployments. Token used once, never stored.
                </p>
              </div>
            )}
            {storedGithub && (
              <p className="t-xs c-subtle" style={{ marginTop: "var(--space-1)", marginBottom: 0 }}>
                Connected as <span className="mono">@{storedGithub}</span> via OAuth — deep activity included automatically.
              </p>
            )}
            {startGithubLink.error && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <ErrorBanner>{(startGithubLink.error as Error).message}</ErrorBanner>
              </div>
            )}
          </div>
          {linkStatus.data?.arcHouse.configured !== false && (
            <label className="t-sm" style={{ display: "grid", gap: 4 }}>
              Arc House handle
              <input className="input" value={arcHouseHandle} onChange={(e) => setArcHouseHandle(e.target.value)} placeholder="your Arc House username" autoComplete="off" />
            </label>
          )}
          <div>
            <p className="t-sm" style={{ margin: "0 0 var(--space-1)" }}>LinkedIn</p>
            {storedLinkedin ? (
              <p className="t-xs c-subtle" style={{ margin: 0 }}>
                Connected as <strong>{storedLinkedin}</strong> — verified account strengthens Professional, Education, and Employment evidence.
              </p>
            ) : (
              <>
                {isOwn && linkStatusPre.data?.linkedin?.oauthConfigured && (
                  <div>
                    <Button onClick={() => startLinkedinLink.mutate()} loading={startLinkedinLink.isPending}>
                      Connect LinkedIn via OAuth
                    </Button>
                    <p className="t-xs c-subtle" style={{ marginTop: "var(--space-1)", marginBottom: 0 }}>
                      Proves account control (name only — no email, no history). Token used once, never stored.
                    </p>
                  </div>
                )}
              </>
            )}
            {startLinkedinLink.error && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <ErrorBanner>{(startLinkedinLink.error as Error).message}</ErrorBanner>
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Button onClick={() => summary.refetch()} loading={summary.isFetching}>Check evidence</Button>
          {isOwn && (
            <Button onClick={handleRefresh} loading={refresh.isPending}>Rebuild graph</Button>
          )}
          {(refresh.isPending) && <Spinner />}
        </div>
        {refresh.error && <div style={{ marginTop: "var(--space-2)" }}><ErrorBanner>{(refresh.error as Error).message}</ErrorBanner></div>}
      </Card>

      {/* DAO & Governance — auto-detected, no form */}
      <Card style={{ marginBottom: "var(--space-5)" }} id="dao">
        <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>DAO & Governance</p>
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-3)" }}>
          Snapshot votes, on-chain governance via Tally, and token holdings are read
          automatically for this wallet — up to +7 toward your trust score.
        </p>
        <DAOScanner address={address} isOwn={isOwn} />
      </Card>

      {/* Badges */}
      <Card style={{ marginBottom: "var(--space-5)" }} id="badges">
        <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Professional & education badges</p>
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-3)" }}>
          Verify a Credly badge or OpenBadge credential you earned. Verified badges become
          evidence that strengthens your trust score — up to 30 points on Professional
          Credentials — and can be attested on-chain as Certification, Course, or
          Bootcamp credentials. Only public badge facts are used, never private data.
        </p>
        <EducationBadgeVerifier
          onEvidenceChange={handleEvidenceChange}
          carryover={schemas.data?.carryover ?? []}
          attestAddress={isOwn ? address : null}
        />
      </Card>

      {/* Attest (own wallet only) */}
      {isOwn && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <p className="t-sm" style={{ marginTop: 0 }}><strong>Commit attestation</strong></p>
          <p className="t-xs c-subtle">Requires ≥60% confidence. Max 3 attestations per hour. Only the verification result is stored on-chain — never raw evidence.</p>
          <label className="t-sm" style={{ display: "grid", gap: 4, marginBottom: "var(--space-3)" }}>
            Credential
            <select className="input" value={selectedSchema} onChange={(e) => setSelectedSchema(e.target.value)}>
              <option value="">Select a credential…</option>
              {liveSchemas.map((sc) => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
          </label>
          <div style={{ display: "grid", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
            <label className="t-sm" style={{ display: "grid", gap: 4 }}>
              Project URI (project credential only)
              <input className="input" value={projectUri} onChange={(e) => setProjectUri(e.target.value)} placeholder="https://github.com/you/arc-project" autoComplete="off" />
            </label>
            <label className="t-sm" style={{ display: "grid", gap: 4 }}>
              Deployment address (project credential only)
              <input className="input" value={deployment} onChange={(e) => setDeployment(e.target.value)} placeholder="0x…" autoComplete="off" />
            </label>
          </div>
          <Button onClick={handleAttest} loading={attest.isPending} disabled={!selectedSchema || !s?.canAttest}>
            Attest on-chain
          </Button>
          {!s?.canAttest && <p className="t-xs c-subtle">Attestation unlocks at 60% confidence — strengthen evidence above.</p>}
          {attest.error && <div style={{ marginTop: "var(--space-2)" }}><ErrorBanner>{(attest.error as Error).message}</ErrorBanner></div>}
          {attestResult && (
            <p className="t-sm" style={{ color: "#00E5A0" }}>
              ✓ Attested —{" "}
              <a href={`${EXPLORER}/tx/${attestResult.txHash}`} target="_blank" rel="noreferrer" className="mono">
                view on ArcScan
              </a>
            </p>
          )}
        </Card>
      )}

      {/* Missing evidence */}
      {missing.data && missing.data.missingEvidence.length > 0 && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <MissingEvidenceList items={missing.data.missingEvidence} />
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  useOpenID3Flow,
  useOpenID3Status,
  useOpenID3Config,
  type OpenID3Config,
  type OpenID3Link,
  type OpenID3Status,
} from "../hooks/useOpenID3";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Callout } from "../components/ui/Callout";
import { PageHeader } from "../components/ui/PageHeader";
import { AddressDisplay } from "../components/ui/AddressDisplay";
import { API_BASE_URL } from "../config/api";

type Phase = "idle" | "selecting" | "redirecting" | "authenticating" | "verifying" | "done" | "failed";

function Progress({ phase }: { phase: Phase }) {
  const steps = [
    { key: "selecting", label: "Select Provider" },
    { key: "redirecting", label: "OAuth Redirect" },
    { key: "authenticating", label: "Authenticate" },
    { key: "verifying", label: "Verify & Attest" },
    { key: "done", label: "Identity Linked" },
  ];
  const current = steps.findIndex((s) => s.key === phase);
  return (
    <div className="web2-proof-steps">
      {steps.map((s, i) => (
        <div key={s.key} className={`web2-proof-step ${i <= current ? "active" : ""} ${i < current ? "done" : ""}`}>
          <span className="step-number">{i < current ? "\u2713" : i + 1}</span>
          <span className="step-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export function OpenID3IdentityPage() {
  const { isConnected } = useAccount();
  const { address, start, poll, verifyWithDAuth } = useOpenID3Flow();
  const { data: status, refetch: refetchStatus } = useOpenID3Status(address);
  const { data: config } = useOpenID3Config();
  const [searchParams, setSearchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [startData, setStartData] = useState<{ linkId: string; authUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Handle OAuth callback — redirect comes back with ?code=...&state=...
  // Also handles server-side Twitter flow: ?success=true or ?error=...
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const providerError = searchParams.get("error");
    const success = searchParams.get("success");

    // Server-side Twitter flow success
    if (success === "true") {
      setPhase("done");
      setSearchParams({}, { replace: true });
      return;
    }

    if (providerError) {
      setError(`OAuth provider returned error: ${providerError}`);
      setPhase("failed");
      setSearchParams({}, { replace: true });
      return;
    }

    if (code && state && address) {
      const linkId = state.split(":")[0];
      const providerId = selectedProvider || state.split(":")[2] || "github";
      setPhase("verifying");

      verifyWithDAuth.mutateAsync({ code, linkId, providerId })
        .then(() => {
          setPhase("done");
          setSearchParams({}, { replace: true });
        })
        .catch((err) => {
          setError(err.message);
          setPhase("failed");
          setSearchParams({}, { replace: true });
        });
    }
  }, [searchParams, address]);

  // Poll for completion (for flows that don't use direct redirect)
  useEffect(() => {
    if (phase === "authenticating" && startData?.linkId) {
      stopPolling();
      pollRef.current = window.setInterval(async () => {
        try {
          const rec = await poll(startData.linkId);
          if (rec.state === "complete") {
            stopPolling();
            setPhase("done");
          } else if (rec.state === "failed" || rec.state === "expired") {
            stopPolling();
            setError(rec.error ?? `Verification ${rec.state}`);
            setPhase("failed");
          }
        } catch {
          // keep polling
        }
      }, 4000);
    }
    return stopPolling;
  }, [phase, startData]);

  // If already verified, show done
  useEffect(() => {
    if (status?.linked && phase === "idle") {
      setPhase("done");
    }
  }, [status]);

  // Refresh the public status once linking completes so the success card
  // shows the fresh handle/expiry (the pre-flow snapshot may be empty).
  useEffect(() => {
    if (phase === "done") {
      void refetchStatus();
    }
  }, [phase]);

  if (!isConnected) return (
    <div className="text-center" style={{ padding: "var(--space-6)" }}>
      <p className="display t-lg" style={{ marginBottom: "var(--space-2)" }}>
        Connect your wallet
      </p>
      <p className="t-sm c-muted" style={{ maxWidth: 380, margin: "0 auto" }}>
        Connect a wallet to link your Web2 identities.
      </p>
    </div>
  );

  const handleSelectProvider = async (providerId: string) => {
    setSelectedProvider(providerId);
    setPhase("redirecting");
    setError(null);
    try {
      const result = await start.mutateAsync(providerId);
      setStartData(result);

      // Twitter: server-side redirect flow (backend handles PKCE + redirect).
      // Same-origin /api path (proxied to Render) — never hardcode the
      // Render URL (see config/api.ts).
      if (providerId === "twitter") {
        window.location.href = `${API_BASE_URL}/openid3/twitter/start?linkId=${result.linkId}`;
      } else {
        // GitHub/Discord: client-side redirect (existing flow)
        window.location.href = result.authUrl;
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("failed");
    }
  };

  const handleRetry = () => {
    setPhase("idle");
    setSelectedProvider(null);
    setStartData(null);
    setError(null);
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Web Accounts · Identity Linking"
        title="Link Web Accounts"
        description="Connect your Web2 accounts (GitHub, X, Discord) to your ArcPass wallet. Prove account ownership with DAuth decentralized authentication."
      />

      {phase !== "idle" && phase !== "selecting" && (
        <Card>
          <Progress phase={phase} />
        </Card>
      )}

      {error && (
        <ErrorBanner onRetry={phase === "failed" ? handleRetry : undefined}>
          {error}
        </ErrorBanner>
      )}

      {phase === "idle" && config && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Select a Provider</h3>
          <p className="text-sm text-gray-500 mb-4">
            Choose which Web2 identity you want to link to your wallet.
            Authentication is handled by DAuth Network for privacy-preserving verification.
          </p>
          {config.providers.every((p: any) => !p.configured) ? (
            <Callout type="warn">
              No OAuth providers are configured. Set{" "}
              <code>OPENID3_GITHUB_CLIENT_ID</code>,{" "}
              <code>OPENID3_TWITTER_CLIENT_ID</code>, or{" "}
              <code>OPENID3_DISCORD_CLIENT_ID</code>{" "}
              in your backend <code>.env</code> to enable identity linking.
            </Callout>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {config.providers.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProvider(p.id)}
                  className="web2-proof-template-card"
                  disabled={!p.configured}
                  style={{ opacity: p.configured ? 1 : 0.4 }}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-gray-500">
                    {p.configured ? p.description : "Not configured"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {phase === "redirecting" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Redirecting to authentication provider...</span>
          </div>
        </Card>
      )}

      {phase === "authenticating" && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Spinner />
              <span>Waiting for provider authentication...</span>
            </div>
            <Callout>
              Complete the login with the provider. This page will automatically
              detect when verification is complete.
            </Callout>
          </div>
        </Card>
      )}

      {phase === "verifying" && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Spinner />
              <span>Verifying via DAuth Network...</span>
            </div>
            <Callout>
              DAuth is generating a zero-knowledge proof of your authentication.
              Your identity remains private — only the proof is shared.
            </Callout>
          </div>
        </Card>
      )}

      {phase === "done" && (
        <DoneCard
          config={config}
          status={status ?? null}
          link={verifyWithDAuth.data ?? null}
          selectedProvider={selectedProvider}
          address={address}
          onRetry={handleRetry}
        />
      )}

      {status?.linked && phase === "done" && (
        <Callout>
          This identity link is publicly visible on your Passport. Anyone can verify it at{" "}
          <code>/passport/<AddressDisplay address={address ?? "0x0000000000000000000000000000000000000000"} truncate /></code>.
        </Callout>
      )}
    </div>
  );
}

function providerDisplayName(
  config: OpenID3Config | undefined,
  ...ids: Array<string | null | undefined>
): string {
  const id = ids.find((v) => v && v.trim());
  if (!id) return "Web2 account";
  const known = config?.providers.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (known) return known.name;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/** Success summary: what was verified, what was issued, and what to do next. */
function DoneCard({
  config,
  status,
  link,
  selectedProvider,
  address,
  onRetry,
}: {
  config: OpenID3Config | undefined;
  status: OpenID3Status | null;
  link: OpenID3Link | null;
  selectedProvider: string | null;
  address: `0x${string}` | undefined;
  onRetry: () => void;
}) {
  const provider = providerDisplayName(config, link?.providerName, status?.provider, selectedProvider);
  const handle = link?.accountHandle || status?.accountHandle;
  const claimId = link?.claimId;
  const txHash = link?.txHash;
  const expiresAt = status?.expiresAt;

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <span className="text-xl">{"\u2713"}</span>
          <span className="font-semibold">{provider} Authentication Done</span>
        </div>
        <p className="text-sm text-gray-500">
          {handle ? (
            <>Your {provider} account <span className="font-mono">@{handle}</span> was verified via
            DAuth Network and linked to your wallet on-chain.</>
          ) : (
            <>Your {provider} account was verified via DAuth Network and linked to your wallet on-chain.</>
          )}
        </p>
        <div className="grid gap-1">
          <div className="text-sm">
            <span className="text-gray-500">Provider: </span>
            <span className="font-mono">{provider}</span>
          </div>
          {handle && (
            <div className="text-sm">
              <span className="text-gray-500">Account: </span>
              <span className="font-mono">@{handle}</span>
            </div>
          )}
          {address && (
            <div className="text-sm">
              <span className="text-gray-500">Wallet: </span>
              <AddressDisplay address={address} truncate />
            </div>
          )}
          {claimId && (
            <div className="text-sm">
              <span className="text-gray-500">Attestation: </span>
              <span className="font-mono" style={{ wordBreak: "break-all" }}>{claimId}</span>
            </div>
          )}
          {txHash && (
            <div className="text-sm">
              <span className="text-gray-500">Transaction: </span>
              <a
                href={`https://testnet.arcscan.app/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono"
                style={{ wordBreak: "break-all" }}
              >
                {txHash} ↗
              </a>
            </div>
          )}
          {expiresAt ? (
            <div className="text-sm">
              <span className="text-gray-500">Attestation expires: </span>
              <span>{new Date(expiresAt * 1000).toLocaleDateString()}</span>
            </div>
          ) : null}
        </div>
        <Callout>
          What this means: an <span className="font-mono">arcpass_openid3_identity</span> attestation
          now points at your wallet. It shows on your Passport, counts as a verified issuer signal,
          and anyone can re-verify it on-chain — no password or token was stored.
        </Callout>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          {address && (
            <a href={`/passport/${address}`}>
              <Button variant="primary">View Passport</Button>
            </a>
          )}
          <Button onClick={onRetry} variant="ghost">
            Link Another Provider
          </Button>
        </div>
      </div>
    </Card>
  );
}

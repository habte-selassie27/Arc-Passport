import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  useOpenID3Flow,
  useOpenID3Status,
  useOpenID3Config,
} from "../hooks/useOpenID3";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Callout } from "../components/ui/Callout";
import { PageHeader } from "../components/ui/PageHeader";
import { AddressDisplay } from "../components/ui/AddressDisplay";

type Phase = "idle" | "selecting" | "starting" | "awaiting" | "verifying" | "done" | "failed";

function Progress({ phase }: { phase: Phase }) {
  const steps = [
    { key: "selecting", label: "Select Provider" },
    { key: "starting", label: "Initialize OAuth" },
    { key: "awaiting", label: "Authenticate with Provider" },
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
  const { address, start, poll, complete } = useOpenID3Flow();
  const { data: status } = useOpenID3Status(address);
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

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (code && state && address) {
      const linkId = state.split(":")[0];
      setPhase("verifying");
      complete.mutateAsync({ code, linkId })
        .then(() => { setPhase("done"); setSearchParams({}, { replace: true }); })
        .catch((err) => { setError(err.message); setPhase("failed"); setSearchParams({}, { replace: true }); });
    }
  }, []);

  // Poll for completion
  useEffect(() => {
    if (phase === "awaiting" && startData?.linkId) {
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
    setPhase("starting");
    setError(null);
    try {
      const result = await start.mutateAsync(providerId);
      setStartData(result);
      setPhase("awaiting");
      // Open OAuth in new tab
      window.open(result.authUrl, "_blank", "noopener,noreferrer");
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
        eyebrow="OpenID3 · Web2 Identity Linking"
        title="Link Web2 Identity"
        description="Connect your Web2 accounts (GitHub, X, Discord, Email) to your ArcPass wallet. Prove account ownership with OAuth-based decentralized authentication."
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
            Choose which Web2 identity you want to link to your wallet. You'll authenticate directly with the provider.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {config.providers.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectProvider(p.id)}
                className="web2-proof-template-card"
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-gray-500">{p.description}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {phase === "starting" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Initializing OAuth session...</span>
          </div>
        </Card>
      )}

      {phase === "awaiting" && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Spinner />
              <span>Waiting for provider authentication...</span>
            </div>
            <Callout>
              A new tab has opened with the authentication provider. Complete the login there, then return here.
              This page will automatically detect when verification is complete.
            </Callout>
          </div>
        </Card>
      )}

      {phase === "verifying" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Verifying identity and issuing on-chain attestation...</span>
          </div>
        </Card>
      )}

      {phase === "done" && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <span className="text-xl">{"\u2713"}</span>
              <span className="font-semibold">Identity Linked</span>
            </div>
            <p className="text-sm text-gray-500">
              Your Web2 identity has been verified and linked to your wallet on-chain.
            </p>
            {status?.provider && (
              <div className="text-sm">
                <span className="text-gray-500">Provider: </span>
                <span className="font-mono">{status.provider}</span>
              </div>
            )}
            {status?.accountHandle && (
              <div className="text-sm">
                <span className="text-gray-500">Account: </span>
                <span className="font-mono">{status.accountHandle}</span>
              </div>
            )}
            {status?.expiresAt && (
              <div className="text-sm">
                <span className="text-gray-500">Expires: </span>
                <span>{new Date(status.expiresAt * 1000).toLocaleDateString()}</span>
              </div>
            )}
            <Button onClick={handleRetry} variant="ghost">
              Link Another Provider
            </Button>
          </div>
        </Card>
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

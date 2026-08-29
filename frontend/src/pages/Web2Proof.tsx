import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  useWeb2ProofFlow,
  useWeb2ProofStatus,
  useWeb2ProofConfig,
  type Web2ProofState,
} from "../hooks/usePrimus";
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
    { key: "selecting", label: "Select Template" },
    { key: "starting", label: "Initialize Verification" },
    { key: "awaiting", label: "Complete Web2 Verification" },
    { key: "verifying", label: "Verify Proof" },
    { key: "done", label: "Attestation Issued" },
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

export function Web2ProofPage() {
  const { isConnected } = useAccount();
  const { address, start, poll, complete } = useWeb2ProofFlow();
  const { data: status } = useWeb2ProofStatus(address);
  const { data: config } = useWeb2ProofConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [startData, setStartData] = useState<{ verificationId: string; authUrl: string } | null>(null);
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
    const taskId = searchParams.get("taskId");
    const verificationId = searchParams.get("verificationId");
    if (taskId && verificationId && address) {
      setPhase("verifying");
      complete.mutateAsync({ taskId, verificationId })
        .then(() => { setPhase("done"); setSearchParams({}, { replace: true }); })
        .catch((err) => { setError(err.message); setPhase("failed"); setSearchParams({}, { replace: true }); });
    }
  }, []);

  // Poll for completion
  useEffect(() => {
    if (phase === "awaiting" && startData?.verificationId) {
      stopPolling();
      pollRef.current = window.setInterval(async () => {
        try {
          const rec = await poll(startData.verificationId);
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
    if (status?.verified && phase === "idle") {
      setPhase("done");
    }
  }, [status]);

  if (!isConnected) return (
    <div className="text-center" style={{ padding: "var(--space-6)" }}>
      <p className="display t-lg" style={{ marginBottom: "var(--space-2)" }}>
        Connect your wallet
      </p>
      <p className="t-sm c-muted" style={{ maxWidth: 380, margin: "0 auto" }}>
        Connect a wallet to verify Web2 data with zero-knowledge TLS proofs.
      </p>
    </div>
  );

  const handleSelectTemplate = async (templateId: string) => {
    setSelectedTemplate(templateId);
    setPhase("starting");
    setError(null);
    try {
      const result = await start.mutateAsync(templateId);
      setStartData(result);
      setPhase("awaiting");
    } catch (err) {
      setError((err as Error).message);
      setPhase("failed");
    }
  };

  const handleRetry = () => {
    setPhase("idle");
    setSelectedTemplate(null);
    setStartData(null);
    setError(null);
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Web2 Data Verification"
        title="Verify Web2 Data"
        description="Prove ownership of Web2 accounts and data using zero-knowledge TLS proofs. Your data stays private — only the cryptographic proof is recorded on-chain."
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
          <h3 className="text-lg font-semibold mb-4">Select a Verification Template</h3>
          <p className="text-sm text-gray-500 mb-4">
            Choose what Web2 data you want to cryptographically verify. Your raw data never leaves your device.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {config.templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t.id)}
                className="web2-proof-template-card"
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-gray-500">{t.description}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {phase === "starting" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Initializing verification task...</span>
          </div>
        </Card>
      )}

      {phase === "awaiting" && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Spinner />
              <span>Verifying with Primus zkTLS network...</span>
            </div>
            <Callout>
              The Primus attestor network is generating a zero-knowledge TLS proof.
              This may take 30-60 seconds. Do not close this page.
            </Callout>
          </div>
        </Card>
      )}

      {phase === "verifying" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Verifying proof and issuing on-chain attestation...</span>
          </div>
        </Card>
      )}

      {phase === "done" && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <span className="text-xl">{"\u2713"}</span>
              <span className="font-semibold">Web2 Data Verified</span>
            </div>
            <p className="text-sm text-gray-500">
              Your Web2 data proof has been cryptographically verified and recorded on-chain as an attestation.
            </p>
            {status?.provider && (
              <div className="text-sm">
                <span className="text-gray-500">Provider: </span>
                <span className="font-mono">{status.provider}</span>
              </div>
            )}
            {status?.expiresAt && (
              <div className="text-sm">
                <span className="text-gray-500">Expires: </span>
                <span>{new Date(status.expiresAt * 1000).toLocaleDateString()}</span>
              </div>
            )}
            <Button onClick={handleRetry} variant="ghost">
              Verify Another Template
            </Button>
          </div>
        </Card>
      )}

      {status?.verified && phase === "done" && (
        <Callout>
          This verification is publicly visible on your Passport. Anyone can verify it at{" "}
          <code>/passport/<AddressDisplay address={address ?? "0x0000000000000000000000000000000000000000"} truncate /></code>.
        </Callout>
      )}
    </div>
  );
}

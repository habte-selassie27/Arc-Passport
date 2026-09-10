import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  useZkPassFlow,
  useWeb2ProofStatus,
  useWeb2ProofConfig,
  useWeb2ProofCompleted,
  markWeb2TemplateDone,
  type Web2ProofState,
} from "../hooks/useZkPass";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Callout } from "../components/ui/Callout";
import { PageHeader } from "../components/ui/PageHeader";
import { AddressDisplay } from "../components/ui/AddressDisplay";

type Phase = "idle" | "checking-extension" | "starting" | "proving" | "submitting" | "done" | "failed";

function Progress({ phase }: { phase: Phase }) {
  const steps = [
    { key: "starting", label: "Initialize Verification" },
    { key: "proving", label: "Complete zkTLS Proof" },
    { key: "submitting", label: "Verify & Attest" },
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
  const { address, start, submitProof, checkExtension, launchVerification, isExtensionAvailable } = useZkPassFlow();
  const { data: status, refetch: refetchStatus } = useWeb2ProofStatus(address);
  const { data: config } = useWeb2ProofConfig();
  const { data: completed = [], refetch: refetchCompleted } = useWeb2ProofCompleted(address);

  const [phase, setPhase] = useState<Phase>("idle");
  const [hasDismissedDone, setHasDismissedDone] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string; zkpassSchemaId: string } | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneNotice, setDoneNotice] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<{ txHash?: string; claimId?: string } | null>(null);

  // Check extension availability on mount
  useEffect(() => {
    if (isConnected) {
      checkExtension();
    }
  }, [isConnected, checkExtension]);

  // If already verified, show done — unless the user explicitly asked to
  // verify another template (otherwise "Verify Another Template" snaps
  // straight back to done and other templates are unreachable).
  useEffect(() => {
    if (status?.verified && phase === "idle" && !hasDismissedDone) {
      setPhase("done");
    }
  }, [status, phase, hasDismissedDone]);

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

  const handleSelectTemplate = async (template: { id: string; name: string; zkpassSchemaId: string }) => {
    // Already completed → banner instead of a redundant verification.
    if (completed.includes(template.zkpassSchemaId)) {
      setDoneNotice(
        `${template.name} is already verified — attestation on record. No need to verify it again.`
      );
      return;
    }
    setDoneNotice(null);
    setSelectedTemplate(template);
    setHasDismissedDone(false);
    setError(null);
    setPhase("starting");
    try {
      const result = await start.mutateAsync(template.zkpassSchemaId);
      setVerificationId(result.verificationId);
      setPhase("proving");
    } catch (err) {
      setError((err as Error).message);
      setPhase("failed");
    }
  };

  const handleLaunchProof = async () => {
    if (!selectedTemplate || !verificationId) return;
    setError(null);
    setPhase("proving");

    try {
      const proof = await launchVerification(selectedTemplate.zkpassSchemaId);
      setPhase("submitting");
      const result = await submitProof.mutateAsync({ verificationId, proof });
      setCompletedResult({ txHash: result.txHash, claimId: result.claimId });
      if (address) markWeb2TemplateDone(address, selectedTemplate.zkpassSchemaId);
      await refetchStatus();
      await refetchCompleted();
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
      setPhase("failed");
    }
  };

  const handleRetry = () => {
    setHasDismissedDone(true);
    setPhase("idle");
    setSelectedTemplate(null);
    setVerificationId(null);
    setError(null);
    setDoneNotice(null);
    setCompletedResult(null);
  };

  // Platform name for the done card: the just-finished template, falling back
  // to the most recently completed one (e.g. after a reload).
  const doneTemplateName =
    selectedTemplate?.name ??
    config?.templates.find((t) => t.zkpassSchemaId === completed[completed.length - 1])?.name;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Web2 Data Verification"
        title="Verify Web2 Data"
        description="Prove ownership of Web2 accounts and data using zero-knowledge TLS proofs. Your data stays private — only the cryptographic proof is recorded on-chain."
      />

      {phase !== "idle" && phase !== "checking-extension" && (
        <Card>
          <Progress phase={phase} />
        </Card>
      )}

      {error && (
        <ErrorBanner onRetry={phase === "failed" ? handleRetry : undefined}>
          {error}
        </ErrorBanner>
      )}

      {/* Extension check */}
      {phase === "checking-extension" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Checking for TransGate extension...</span>
          </div>
        </Card>
      )}

      {/* Template selection */}
      {phase === "idle" && config && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Select a Verification Template</h3>
          <p className="text-sm text-gray-500 mb-4">
            Choose what Web2 data you want to cryptographically verify. Your raw data never leaves your device.
          </p>
          {doneNotice && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <Callout type="tip">{doneNotice}</Callout>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {config.templates.map((t) => {
              const done = completed.includes(t.zkpassSchemaId);
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className="web2-proof-template-card"
                  style={done ? { opacity: 0.75 } : undefined}
                  title={done ? "Already verified" : undefined}
                >
                  <div className="font-medium flex items-center gap-2">
                    {t.name}
                    {done && (
                      <span
                        className="chip"
                        style={{ background: "rgba(0,229,160,0.15)", color: "#00E5A0", fontSize: "0.65rem" }}
                      >
                        ✓ Done
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{t.description}</div>
                </button>
              );
            })}
          </div>
          {isExtensionAvailable === false && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <Callout>
                <strong>Tip:</strong> Install the{" "}
                <a
                  href="https://chromewebstore.google.com/detail/zkpass-transgate/afkoofjocpbclhnldmmaphappihehpma"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  TransGate Chrome extension
                </a>{" "}
                for a smoother experience. Without it, you can scan a QR code on mobile instead.
              </Callout>
            </div>
          )}
        </Card>
      )}

      {/* Starting verification */}
      {phase === "starting" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Initializing verification...</span>
          </div>
        </Card>
      )}

      {/* Awaiting proof */}
      {phase === "proving" && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Spinner />
              <span>Waiting for zkTLS proof...</span>
            </div>
            <Callout>
              The TransGate extension will open a new tab for you to complete the verification.
              Log in to your account and click "Start" in the extension popup.
              This may take 30-60 seconds. Do not close this page.
            </Callout>
            <Button onClick={handleLaunchProof} variant="primary">
              Launch Verification
            </Button>
          </div>
        </Card>
      )}

      {/* Submitting proof */}
      {phase === "submitting" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Verifying proof and issuing on-chain attestation...</span>
          </div>
        </Card>
      )}

      {/* Done */}
      {phase === "done" && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <span className="text-xl">{"\u2713"}</span>
              <span className="font-semibold">Web2 Data Verified</span>
            </div>
            {doneTemplateName && (
              <p className="text-sm font-medium" style={{ color: "var(--color-verified, #00E5A0)" }}>
                You have finished ZK attestation — {doneTemplateName}
              </p>
            )}
            <p className="text-sm text-gray-500">
              Your web2 data proof has been cryptographically verified and recorded on-chain as an attestation.
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
            {completedResult?.txHash && (
              <div className="text-sm">
                <span className="text-gray-500">Transaction: </span>
                <a
                  href={`https://testnet.arcscan.app/tx/${completedResult.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-500 hover:underline"
                >
                  {completedResult.txHash.slice(0, 10)}...{completedResult.txHash.slice(-8)}
                </a>
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

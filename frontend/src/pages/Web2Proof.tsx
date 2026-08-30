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
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Callout } from "../components/ui/Callout";
import { PageHeader } from "../components/ui/PageHeader";
import { AddressDisplay } from "../components/ui/AddressDisplay";

type Phase = "idle" | "selecting" | "starting" | "awaiting" | "verifying" | "done" | "failed"
  | "entering-email" | "sending-otp" | "entering-otp" | "verifying-otp";

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
  const { address, start, poll, complete, startEmail, verifyEmail } = useWeb2ProofFlow();
  const { data: status } = useWeb2ProofStatus(address);
  const { data: config } = useWeb2ProofConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [startData, setStartData] = useState<{ verificationId: string; authUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Email OTP state
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [emailVerificationId, setEmailVerificationId] = useState<string | null>(null);

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

  // Poll for completion (Primus flow)
  useEffect(() => {
    if (phase === "awaiting" && startData?.verificationId) {
      stopPolling();
      let pollErrors = 0;
      const MAX_POLL_ERRORS = 10;
      pollRef.current = window.setInterval(async () => {
        try {
          const rec = await poll(startData.verificationId);
          pollErrors = 0;
          if (rec.state === "complete") {
            stopPolling();
            setPhase("done");
          } else if (rec.state === "failed" || rec.state === "expired") {
            stopPolling();
            setError(rec.error ?? `Verification ${rec.state}`);
            setPhase("failed");
          }
        } catch {
          pollErrors++;
          if (pollErrors >= MAX_POLL_ERRORS) {
            stopPolling();
            setError("Verification polling timed out. The backend may be unavailable.");
            setPhase("failed");
          }
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

  const START_TIMEOUT_MS = 15_000;

  const handleSelectTemplate = async (templateId: string) => {
    setSelectedTemplate(templateId);
    setError(null);

    // Email template takes a different path
    if (templateId === "email-ownership") {
      setPhase("entering-email");
      return;
    }

    setPhase("starting");
    try {
      const result = await Promise.race([
        start.mutateAsync(templateId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out — the backend may be unavailable. Please try again.")), START_TIMEOUT_MS)
        ),
      ]);
      setStartData(result);
      setPhase("awaiting");
    } catch (err) {
      setError((err as Error).message);
      setPhase("failed");
    }
  };

  const handleSendOtp = async () => {
    if (!email || !selectedTemplate) return;
    setPhase("sending-otp");
    setError(null);
    try {
      const result = await startEmail.mutateAsync({ email, templateId: selectedTemplate });
      setEmailVerificationId(result.verificationId);
      setPhase("entering-otp");
    } catch (err) {
      setError((err as Error).message);
      setPhase("entering-email");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || !emailVerificationId) return;
    setPhase("verifying-otp");
    setError(null);
    try {
      await verifyEmail.mutateAsync({ verificationId: emailVerificationId, code: otpCode });
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
      setPhase("entering-otp");
    }
  };

  const handleRetry = () => {
    setPhase("idle");
    setSelectedTemplate(null);
    setStartData(null);
    setError(null);
    setEmail("");
    setOtpCode("");
    setEmailVerificationId(null);
  };

  const isEmailFlow = selectedTemplate === "email-ownership";

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Web2 Data Verification"
        title="Verify Web2 Data"
        description="Prove ownership of Web2 accounts and data using zero-knowledge TLS proofs. Your data stays private — only the cryptographic proof is recorded on-chain."
      />

      {phase !== "idle" && phase !== "selecting" && phase !== "entering-email" && phase !== "entering-otp" && (
        <Card>
          <Progress phase={phase} />
        </Card>
      )}

      {error && (
        <ErrorBanner onRetry={phase === "failed" ? handleRetry : undefined}>
          {error}
        </ErrorBanner>
      )}

      {/* Template selection */}
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

      {/* Email input */}
      {phase === "entering-email" && (
        <Card>
          <h3 className="text-lg font-semibold mb-2">Email Ownership Verification</h3>
          <p className="text-sm text-gray-500 mb-4">
            Enter the email address you want to verify. We'll send a one-time code to confirm ownership.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              style={{ flex: 1 }}
            />
            <Button onClick={handleSendOtp} disabled={!email || startEmail.isPending}>
              {startEmail.isPending ? <Spinner /> : "Send Code"}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRetry} style={{ marginTop: "var(--space-3)" }}>
            Back to templates
          </Button>
        </Card>
      )}

      {/* OTP input */}
      {phase === "entering-otp" && (
        <Card>
          <h3 className="text-lg font-semibold mb-2">Enter Verification Code</h3>
          <p className="text-sm text-gray-500 mb-4">
            We sent a 6-digit code to <strong>{email}</strong>. Check your inbox and enter it below.
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
              style={{ flex: 1, fontFamily: "monospace", letterSpacing: "0.2em", fontSize: "1.25rem" }}
            />
            <Button onClick={handleVerifyOtp} disabled={otpCode.length !== 6 || verifyEmail.isPending}>
              {verifyEmail.isPending ? <Spinner /> : "Verify"}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setPhase("entering-email"); setOtpCode(""); }} style={{ marginTop: "var(--space-3)" }}>
            Change email
          </Button>
        </Card>
      )}

      {/* Sending OTP spinner */}
      {phase === "sending-otp" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Sending verification code to {email}...</span>
          </div>
        </Card>
      )}

      {/* Verifying OTP spinner */}
      {phase === "verifying-otp" && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Spinner />
              <span>Verifying code and issuing attestation...</span>
            </div>
          </div>
        </Card>
      )}

      {/* Primus initializing */}
      {phase === "starting" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Initializing verification task...</span>
          </div>
        </Card>
      )}

      {/* Primus awaiting */}
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

      {/* Verifying proof */}
      {phase === "verifying" && (
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
            <p className="text-sm text-gray-500">
              Your {isEmailFlow ? "email ownership" : "web2 data"} proof has been cryptographically verified and recorded on-chain as an attestation.
            </p>
            {isEmailFlow && (
              <div className="text-sm">
                <span className="text-gray-500">Email: </span>
                <span className="font-mono">{email}</span>
              </div>
            )}
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

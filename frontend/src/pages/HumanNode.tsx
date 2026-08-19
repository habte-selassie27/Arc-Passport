import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Callout } from "../components/ui/Callout";
import { HumanNodeProgress } from "../components/human-node/HumanNodeProgress";
import { HumanNodeCredential } from "../components/human-node/HumanNodeCredential";
import {
  useHumanityStatus,
  useHumanodeConfig,
  useHumanodeFlow,
  type HumanodeState,
} from "../hooks/useHumanode";

type Phase = "idle" | "starting" | "awaiting" | "verifying" | "done" | "failed" | "expired";

export function HumanNodePage() {
  const { isConnected, address } = useAccount();
  const { start, complete, poll } = useHumanodeFlow();
  const statusQuery = useHumanityStatus(address);
  const configQuery = useHumanodeConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [startData, setStartData] = useState<{ verificationId: string; authorizeUrl: string; state: string } | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // If the connected wallet is already verified, jump straight to the credential.
  useEffect(() => {
    if (statusQuery.data?.verified && phase === "idle") {
      setPhase("done");
    }
  }, [statusQuery.data, phase]);

  // Handle OAuth redirect (?code=...&state=...).
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (code && state && address) {
      const verificationId = state.split(":")[0];
      setPhase("verifying");
      setError(null);
      complete
        .mutateAsync({ code, state, verificationId })
        .then(() => {
          setPhase("done");
          setSearchParams({}, { replace: true });
        })
        .catch((err) => {
          setError((err as Error).message);
          setPhase("failed");
          setSearchParams({}, { replace: true });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback polling while awaiting the Humanode redirect.
  useEffect(() => {
    if ((phase === "awaiting" || phase === "verifying") && startData?.verificationId) {
      stopPolling();
      pollRef.current = window.setInterval(async () => {
        try {
          const rec = await poll(startData.verificationId);
          if (rec.state === "complete") {
            stopPolling();
            setPhase("done");
          } else if (rec.state === "failed") {
            stopPolling();
            setError(rec.error ?? "Verification failed");
            setPhase("failed");
          }
        } catch {
          /* transient — keep polling */
        }
      }, 4000);
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, startData]);

  const handleStart = async () => {
    setError(null);
    setPhase("starting");
    try {
      const data = await start.mutateAsync();
      setStartData(data);
      setPhase("awaiting");
      // Take the user to Humanode; they'll be redirected back here with ?code&state.
      window.location.assign(data.authorizeUrl);
    } catch (err) {
      setError((err as Error).message);
      setPhase("failed");
    }
  };

  const reset = () => {
    setError(null);
    setStartData(null);
    setPhase("idle");
  };

  // ── Disconnected ──
  if (!isConnected) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Humanode · Proof of Personhood"
          title="Verify Humanity"
          description="Prove you are a unique, living human using Humanode's private biometric verification. ArcPass stores only a cryptographic commitment — never your face or personal data."
        />
        <Card>
          <EmptyConnect />
        </Card>
      </div>
    );
  }

  const uiState: HumanodeState | "idle" | "starting" | "awaiting" | "verifying" =
    phase === "done" || phase === "failed" || phase === "expired"
      ? statusQuery.data?.state ?? "idle"
      : phase;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Humanode · Proof of Personhood"
        title="Verify Humanity"
        description="One unique human per account. Your biometric information never leaves Humanode's confidential infrastructure."
      />

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <HumanNodeProgress state={uiState} failed={phase === "failed"} />
      </Card>

      {/* Already verified / completed */}
      {phase === "done" && statusQuery.data && (
        <>
          <HumanNodeCredential status={statusQuery.data} />
          <div className="text-center" style={{ marginTop: "var(--space-4)" }}>
            <Button variant="ghost" size="sm" onClick={() => statusQuery.refetch()}>
              Refresh status
            </Button>
          </div>
        </>
      )}

      {/* Idle — CTA */}
      {phase === "idle" && (
        <Card>
          <p className="t-sm c-muted" style={{ lineHeight: 1.6 }}>
            Humanode verifies that you are a real, unique, living human using facial
            biometrics processed inside confidential infrastructure. The result is a
            reusable proof you can use across ArcPass and any integrated dApp.
          </p>
          {configQuery.data?.description && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <Callout type="tip">{configQuery.data.description}</Callout>
            </div>
          )}
          <div style={{ marginTop: "var(--space-4)" }}>
            <Button onClick={handleStart} disabled={statusQuery.isLoading}>
              {statusQuery.isLoading ? <Spinner size={16} /> : "Verify Humanity"}
            </Button>
          </div>
        </Card>
      )}

      {/* Starting / awaiting / verifying */}
      {(phase === "starting" || phase === "awaiting" || phase === "verifying") && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner size={18} />
            <div>
              <p className="t-sm" style={{ fontWeight: 600 }}>
                {phase === "starting" && "Preparing verification session…"}
                {phase === "awaiting" && "Awaiting Humanode verification"}
                {phase === "verifying" && "Verifying with Humanode & issuing proof…"}
              </p>
              <p className="t-xs c-subtle" style={{ marginTop: 2 }}>
                {phase === "awaiting"
                  ? "Complete the biometric check in the Humanode window. You'll be redirected back automatically."
                  : "Do not close this tab."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Failed */}
      {phase === "failed" && (
        <ErrorBanner onRetry={reset}>Verification failed: {error}</ErrorBanner>
      )}

      {error && phase !== "failed" && (
        <ErrorBanner onRetry={reset}>{error}</ErrorBanner>
      )}
    </div>
  );
}

function EmptyConnect() {
  return (
    <div className="text-center" style={{ padding: "var(--space-6)" }}>
      <p className="display t-lg" style={{ marginBottom: "var(--space-2)" }}>
        Connect your wallet
      </p>
      <p className="t-sm c-muted" style={{ maxWidth: 380, margin: "0 auto" }}>
        Connect a wallet to begin humanity verification. No personal information is
        required to start.
      </p>
    </div>
  );
}

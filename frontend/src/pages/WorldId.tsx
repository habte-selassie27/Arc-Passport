import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { IDKitRequestWidget, type IDKitResult, type IDKitErrorCodes, orbLegacy } from "@worldcoin/idkit";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Callout } from "../components/ui/Callout";
import { PersonhoodProgress } from "../components/personhood/PersonhoodProgress";
import { PersonhoodCredential } from "../components/personhood/PersonhoodCredential";
import {
  useWorldIdFlow,
} from "../hooks/useWorldId";
import { useLiveness, useLivenessStatus, type LivenessAction } from "../hooks/useLiveness";

type Phase = "idle" | "pending-proof" | "verifying" | "done" | "failed";
type Method = "camera" | "worldid" | null;

const WORLD_ID_APP_ID = import.meta.env.VITE_WORLD_ID_APP_ID ?? "";
const WORLD_ID_RP_ID = import.meta.env.VITE_WORLD_ID_RP_ID ?? "";
// Production matches where the Developer Portal app lives; staging needs a
// separately registered app. See VITE_WORLD_ID_ENVIRONMENT in .env.example.
const WORLD_ID_ENVIRONMENT =
  (import.meta.env.VITE_WORLD_ID_ENVIRONMENT as "staging" | "production" | undefined) ??
  "production";

const STEP_LABELS: Record<LivenessAction, string> = {
  blink: "Blink twice",
  turn_left: "Turn your head left",
  turn_right: "Turn your head right",
};

export function WorldIdPage() {
  const isConnected = useAccount().isConnected;
  const address = useAccount().address;
  const [method, setMethod] = useState<Method>(null);

  // Reset method chooser when wallet changes
  useEffect(() => {
    setMethod(null);
  }, [address]);

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Humanity · Proof of Personhood"
          title="Verify Humanity"
          description="Prove you are a unique, living human. Two options: an on-device camera liveness check that works everywhere, or World ID where available."
        />
        <Card>
          <EmptyConnect />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Humanity · Proof of Personhood"
        title="Verify Humanity"
        description="Prove you are a real, unique, living human and receive an on-chain credential."
      />

      {/* Method chooser */}
      {!method && (
        <div className="grid gap-4">
          <MethodCard
            title="Camera Liveness"
            badge="Works everywhere"
            description="Follow on-screen prompts — blink, turn your head. Runs fully in your browser; frames are never stored."
            onClick={() => setMethod("camera")}
          />
          <MethodCard
            title="World App"
            badge={WORLD_ID_APP_ID ? "Where available" : "Not configured"}
            description="Scan a QR code with the World App for biometric-grade proof, then verified on-chain via Humanity Oracle."
            onClick={() => setMethod("worldid")}
            disabled={!WORLD_ID_APP_ID || !WORLD_ID_RP_ID}
          />
        </div>
      )}

      {method === "camera" && <CameraFlow onBack={() => setMethod(null)} />}
      {method === "worldid" && <WorldIdFlow onBack={() => setMethod(null)} />}
      {method && address && <DoneCheck address={address} key={method} />}
    </div>
  );
}

// ── Camera liveness flow ──

function CameraFlow({ onBack }: { onBack: () => void }) {
  const { phase, error, challenge, stepIndex, stepProgress, videoRef, start, reset } =
    useLiveness();

  useEffect(() => {
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = challenge?.steps[stepIndex];
  const failed = phase === "failed";

  return (
    <>
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <PersonhoodProgress
          state={
            phase === "done"
              ? "complete"
              : phase === "submitting"
                ? "attesting"
                : phase === "running"
                  ? "awaiting"
                  : "idle"
          }
          failed={failed}
        />
      </Card>

      {(phase === "starting" || phase === "running") && (
        <Card>
          <div className="relative" style={{ borderRadius: "var(--radius-md)", overflow: "hidden", background: "#000", aspectRatio: "4 / 3" }}>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
            {/* Progress ring */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                padding: "var(--space-3)",
              }}
            >
              <div style={{ background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: 999, padding: "6px 14px", minWidth: 220, textAlign: "center" }}>
                <p className="t-sm" style={{ fontWeight: 600 }}>
                  {phase === "starting"
                    ? "Starting camera & detector…"
                    : current
                      ? STEP_LABELS[current]
                      : ""}
                </p>
                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.25)", marginTop: 6, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(stepProgress * 100)}%`, height: "100%", background: "var(--color-verified)" }} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ marginTop: "var(--space-3)" }}>
            <span className="t-xs c-subtle">
              Frames are processed in your browser — never stored.
            </span>
            <Button variant="ghost" size="sm" onClick={reset}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {phase === "idle" && (
        <Card>
          <p className="t-sm c-muted" style={{ lineHeight: 1.6 }}>
            Your camera will run locally for a short guided check. Nothing is uploaded until
            you finish, and evidence frames are processed in memory only — they are never
            written to disk or IPFS.
          </p>
          <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)" }}>
            <Button onClick={start}>Start camera check</Button>
            <Button variant="ghost" size="sm" onClick={onBack}>
              Other methods
            </Button>
          </div>
        </Card>
      )}

      {phase === "submitting" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner size={18} />
            <p className="t-sm" style={{ fontWeight: 600 }}>
              Verifying liveness & issuing on-chain attestation…
            </p>
          </div>
        </Card>
      )}

      {failed && (
        <ErrorBanner onRetry={reset}>{error ?? "Verification failed"}</ErrorBanner>
      )}
    </>
  );
}

// ── World ID flow ──

function WorldIdFlow({ onBack }: { onBack: () => void }) {
  const { getRpSignature, verify } = useWorldIdFlow();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [idkitOpen, setIdkitOpen] = useState(false);
  const [rpContext, setRpContext] = useState<{
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  } | null>(null);

  const handleStart = async () => {
    setError(null);
    setPhase("pending-proof");
    try {
      const sig = await getRpSignature.mutateAsync("verify-humanity");
      setRpContext({
        rp_id: WORLD_ID_RP_ID,
        nonce: sig.nonce,
        created_at: Number(sig.created_at),
        expires_at: Number(sig.expires_at),
        signature: sig.sig,
      });
      setIdkitOpen(true);
    } catch (err) {
      setError((err as Error).message);
      setPhase("failed");
    }
  };

  const handleIdkitVerify = async (result: IDKitResult) => {
    setPhase("verifying");
    setIdkitOpen(false);
    try {
      await verify.mutateAsync({
        rpId: WORLD_ID_RP_ID,
        idkitResponse: result,
      });
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
      setPhase("failed");
    }
  };

  const handleIdkitError = (errorCode: IDKitErrorCodes) => {
    console.error("[WorldID] IDKit error:", errorCode);
    if (errorCode === "user_rejected" || errorCode === "verification_rejected") {
      setPhase("idle");
      setIdkitOpen(false);
      return;
    }
    setError((prev) => (prev && errorCode === "failed_by_host_app" ? prev : errorCode));
    setPhase("failed");
    setIdkitOpen(false);
  };

  const reset = () => {
    setError(null);
    setPhase("idle");
    setRpContext(null);
    setIdkitOpen(false);
  };

  return (
    <>
      {phase === "idle" && (
        <Card>
          <p className="t-sm c-muted" style={{ lineHeight: 1.6 }}>
            Scan the QR code with the World App for biometric-grade proof. Your World ID
            nullifier is submitted to the Humanity Oracle on Arc, which issues the
            on-chain attestation. Requires a World App account — not available in all countries.
          </p>
          <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)" }}>
            <Button onClick={handleStart} disabled={getRpSignature.isPending}>
              {getRpSignature.isPending ? <Spinner size={16} /> : "Verify with World App"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onBack}>
              Other methods
            </Button>
          </div>
        </Card>
      )}

      {phase === "pending-proof" && rpContext && (
        <Card>
          <IDKitRequestWidget
            open={idkitOpen}
            onOpenChange={setIdkitOpen}
            app_id={WORLD_ID_APP_ID}
            action="verify-humanity"
            rp_context={rpContext}
            allow_legacy_proofs={true}
            environment={WORLD_ID_ENVIRONMENT}
            preset={orbLegacy()}
            handleVerify={handleIdkitVerify}
            onSuccess={() => {}}
            onError={handleIdkitError}
          />
          <div className="flex items-center gap-3">
            <Spinner size={18} />
            <p className="t-sm">Waiting for World App verification…</p>
          </div>
        </Card>
      )}

      {phase === "verifying" && (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner size={18} />
            <p className="t-sm" style={{ fontWeight: 600 }}>
              Verifying proof & issuing on-chain attestation…
            </p>
          </div>
        </Card>
      )}

      {phase === "failed" && (
        <ErrorBanner onRetry={reset}>Verification failed: {error}</ErrorBanner>
      )}
    </>
  );
}

// ── Shared done-state card ──

function DoneCheck({ address }: { address: `0x${string}` }) {
  const livenessQuery = useLivenessStatus(address);

  useEffect(() => {
    void livenessQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = livenessQuery.data?.verified ? livenessQuery.data : undefined;
  if (!status?.verified) return null;

  return (
    <>
      <PersonhoodCredential status={{ ...status, state: "complete" }} />
      <div className="text-center" style={{ marginTop: "var(--space-4)" }}>
        <Button variant="ghost" size="sm" onClick={() => { void livenessQuery.refetch(); }}>
          Refresh status
        </Button>
      </div>
    </>
  );
}

function MethodCard({
  title,
  badge,
  description,
  onClick,
  disabled,
}: {
  title: string;
  badge: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card style={{ opacity: disabled ? 0.5 : 1 }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-lg" style={{ fontWeight: 700 }}>{title}</p>
          <p className="t-sm c-muted" style={{ marginTop: 4, lineHeight: 1.5 }}>{description}</p>
        </div>
        <span className="chip chip--valid" style={{ flexShrink: 0 }}>{badge}</span>
      </div>
      <div style={{ marginTop: "var(--space-3)" }}>
        <Button size="sm" onClick={onClick} disabled={disabled}>
          Continue →
        </Button>
      </div>
    </Card>
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
      <div style={{ marginTop: "var(--space-3)" }}>
        <Callout type="tip">
          The camera liveness check runs entirely in your browser — no third-party account
          needed.
        </Callout>
      </div>
    </div>
  );
}

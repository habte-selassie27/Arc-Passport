/**
 * ZKPassport.tsx — ZK Passport verification page.
 *
 * What it does: displays the ZK passport verification flow — list verifiers,
 *   submit proofs (Layer 1 authenticity + Layer 2 attribute proofs), check status.
 * What it does NOT do: generate ZK proofs (that happens on the user's device).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useZKVerifiers, useZKStats, useZKProofStatus, useSubmitPassportProof, useSubmitAttributeProof, useVerifyZKProof } from "../hooks/useZKProof";
import { useZkVault, useVaultBadge } from "../hooks/useZkVault";
import { useIdentityHistory } from "../hooks/useIdentity";
import {
  describeFace,
  loadImageEl,
  matchDescriptors,
  FACE_MATCH_THRESHOLD,
  type FaceMatchResult,
} from "../utils/faceMatch";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Callout } from "../components/ui/Callout";
import { CardSkeleton } from "../components/ui/Skeleton";
import { AddressDisplay } from "../components/ui/AddressDisplay";

// ── Types ─────────────────────────────────────────────────────────────────

type Tab = "overview" | "vault" | "verify" | "submit" | "status";

// ── Main Page ─────────────────────────────────────────────────────────────

export function ZKPassportPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Zero-Knowledge Identity"
        title="ZK Passport"
        description="Privacy-preserving identity verification. Prove what you need, reveal nothing extra."
      />
      <div className="flex gap-2" style={{ marginBottom: "var(--space-6)" }}>
        {(["overview", "vault", "verify", "submit", "status"] as const).map((tab) => (
          <button
            key={tab}
            className={`btn btn--${activeTab === tab ? "primary" : "ghost"} btn--sm`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "vault" ? "🔒 ID Vault" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "vault" && <VaultTab />}
      {activeTab === "verify" && <VerifyTab />}
      {activeTab === "submit" && <SubmitTab />}
      {activeTab === "status" && <StatusTab />}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useZKStats();
  const { data: verifiers, isLoading: verifiersLoading, error: verifiersError, refetch: refetchVerifiers } = useZKVerifiers();

  if (statsLoading || verifiersLoading) return <CardSkeleton />;
  if (statsError) return <ErrorBanner onRetry={() => void refetchStats()}>Failed to load ZK stats</ErrorBanner>;
  if (verifiersError) return <ErrorBanner onRetry={() => void refetchVerifiers()}>Failed to load verifiers</ErrorBanner>;

  return (
    <div>
      {/* Stats Grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: "var(--space-6)" }}>
        <StatCard label="Proofs Verified" value={stats?.totalProofsVerified ?? 0} color="var(--color-arc-primary)" />
        <StatCard label="Active Verifiers" value={stats?.activeVerifiers ?? 0} color="var(--color-verified)" />
        <StatCard label="Total Verifiers" value={stats?.totalVerifiers ?? 0} />
      </div>

      {/* Dual-Layer Model */}
      <Card style={{ marginBottom: "var(--space-6)" }}>
        <h3 className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-3)" }}>Dual-Layer Proof Model</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--color-surface-1)" }}>
            <span className="chip" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6", fontSize: "0.65rem", marginBottom: "var(--space-2)", display: "inline-block" }}>
              Layer 1
            </span>
            <p className="t-sm" style={{ fontWeight: 600, marginTop: "var(--space-1)" }}>Passport Authenticity</p>
            <p className="t-xs c-subtle" style={{ marginTop: "var(--space-1)" }}>
              Verifies the government-issued document is authentic via NFC chip cryptographic signature. Proves document validity without revealing personal data.
            </p>
          </div>
          <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--color-surface-1)" }}>
            <span className="chip" style={{ background: "rgba(0,229,160,0.15)", color: "#00E5A0", fontSize: "0.65rem", marginBottom: "var(--space-2)", display: "inline-block" }}>
              Layer 2
            </span>
            <p className="t-sm" style={{ fontWeight: 600, marginTop: "var(--space-1)" }}>Attribute Proof</p>
            <p className="t-xs c-subtle" style={{ marginTop: "var(--space-1)" }}>
              Proves specific attributes (age ≥ 18, nationality, etc.) without revealing the underlying data. Selective disclosure at the field level.
            </p>
          </div>
        </div>
      </Card>

      {/* Registered Verifiers */}
      <Card>
        <h3 className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-3)" }}>Registered Verifier Backends</h3>
        {!verifiers || verifiers.verifiers.length === 0 ? (
          <EmptyState title="No verifiers" body="No ZK verifier backends have been registered yet." />
        ) : (
          <div className="grid gap-2">
            {verifiers.verifiers.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between"
                style={{ padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", background: "var(--color-surface-1)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="chip" style={{ background: v.active ? "rgba(0,229,160,0.15)" : "rgba(156,163,175,0.15)", color: v.active ? "#00E5A0" : "#9CA3AF", fontSize: "0.65rem" }}>
                    {v.active ? "Active" : "Inactive"}
                  </span>
                  <div>
                    <p className="t-sm" style={{ fontWeight: 600 }}>{v.name}</p>
                    <AddressDisplay address={v.backend} className="t-xs c-subtle" />
                  </div>
                </div>
                <span className="mono t-xs c-subtle">ID: {v.id}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* How It Works */}
      <Card style={{ marginTop: "var(--space-6)" }}>
        <h3 className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-3)" }}>How ZK Passport Works</h3>
        <div className="grid gap-3">
          {[
            { step: 1, label: "Scan NFC Chip", desc: "User scans their government ID's NFC chip using a mobile device." },
            { step: 2, label: "Verify Authenticity", desc: "The chip's digital signature is verified against the issuing country's PKI." },
            { step: 3, label: "Generate ZK Proof", desc: "On-device ZK circuit generates a cryptographic proof of the document's validity." },
            { step: 4, label: "Submit to ArcPass", desc: "The proof is submitted on-chain. An attestation is issued without any PII leaving the device." },
            { step: 5, label: "Selective Disclosure", desc: "Prove specific attributes (age ≥ 18, nationality) without revealing the full document." },
          ].map(({ step, label, desc }) => (
            <div key={step} className="flex gap-3 items-start">
              <span className="mono t-sm" style={{ color: "var(--color-arc-primary)", fontWeight: 700, minWidth: 24 }}>{step}.</span>
              <div>
                <p className="t-sm" style={{ fontWeight: 600 }}>{label}</p>
                <p className="t-xs c-subtle">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Verify Tab ────────────────────────────────────────────────────────────

function VerifyTab() {
  const [proofHash, setProofHash] = useState("");
  const [verifierId, setVerifierId] = useState("0");
  const [subject, setSubject] = useState("");
  const { address } = useAccount();
  const verifyMutation = useVerifyZKProof();

  const handleVerify = () => {
    if (!proofHash || !subject) return;
    verifyMutation.mutate({
      verifierId: parseInt(verifierId, 10),
      proof: "0x", // placeholder — real proof comes from NFC scan
      publicInputs: [],
      subject,
      proofHash,
    });
  };

  return (
    <div>
      <Card>
        <h3 className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-3)" }}>Verify ZK Proof (Dry Run)</h3>
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-4)" }}>
          Check if a proof hash has been used and whether it's ready for submission. This does NOT issue an attestation.
        </p>

        <div className="grid gap-3" style={{ marginBottom: "var(--space-4)" }}>
          <div>
            <label className="t-xs c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>Verifier ID</label>
            <Input
              mono
              type="number"
              value={verifierId}
              onChange={(e) => setVerifierId(e.target.value)}
              placeholder="0"
              style={{ maxWidth: 120 }}
            />
          </div>
          <div>
            <label className="t-xs c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>Proof Hash (bytes32)</label>
            <Input
              mono
              type="text"
              value={proofHash}
              onChange={(e) => setProofHash(e.target.value)}
              placeholder="0x..."
            />
          </div>
          <div>
            <label className="t-xs c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>Subject Address</label>
            <Input
              mono
              type="text"
              value={subject || address || ""}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="0x..."
            />
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleVerify}
          disabled={!proofHash || !subject || verifyMutation.isPending}
        >
          {verifyMutation.isPending ? "Verifying..." : "Verify Proof"}
        </Button>

        {verifyMutation.isError && (
          <div style={{ marginTop: "var(--space-3)" }}><ErrorBanner>{verifyMutation.error.message}</ErrorBanner></div>
        )}

        {verifyMutation.data && (
          <Card style={{ marginTop: "var(--space-4)", background: "var(--color-surface-1)" }}>
            <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>Result</p>
            <div className="data-row">
              <span className="data-row__label">Proof Hash</span>
              <span className="mono t-xs" style={{ color: "var(--color-on-bright)" }}>{verifyMutation.data.proofHash}</span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Already Used</span>
              <span className="t-sm" style={{ color: verifyMutation.data.alreadyUsed ? "var(--color-danger)" : "var(--color-verified)" }}>
                {verifyMutation.data.alreadyUsed ? "Yes (replay detected)" : "No — ready for submission"}
              </span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Message</span>
              <span className="t-sm">{verifyMutation.data.message}</span>
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
}

// ── Submit Tab ────────────────────────────────────────────────────────────

function SubmitTab() {
  const { address } = useAccount();
  const [verifierId, setVerifierId] = useState("0");
  const [proofHash, setProofHash] = useState("");
  const [documentType, setDocumentType] = useState("passport");
  const [layer, setLayer] = useState<"auth" | "attribute">("auth");
  const [attributeType, setAttributeType] = useState("age >= 18");

  const authMutation = useSubmitPassportProof();
  const attrMutation = useSubmitAttributeProof();

  const handleSubmit = () => {
    if (!address || !proofHash) return;

    if (layer === "auth") {
      authMutation.mutate({
        verifierId: parseInt(verifierId, 10),
        proof: "0x", // placeholder — real proof from NFC scan
        publicInputs: [],
        proofHash,
        documentType,
      });
    } else {
      attrMutation.mutate({
        verifierId: parseInt(verifierId, 10),
        proof: "0x",
        publicInputs: [],
        proofHash,
        attributeHash: `0x${Array.from(new TextEncoder().encode(attributeType)).map(b => b.toString(16).padStart(2, "0")).join("").padEnd(64, "0")}` as `0x${string}`,
      });
    }
  };

  const isPending = authMutation.isPending || attrMutation.isPending;
  const error = authMutation.error || attrMutation.error;
  const data = (authMutation.data || attrMutation.data) as { txHash?: string; claimId?: string; message?: string } | undefined;

  return (
    <div>
      <Card>
        <h3 className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-3)" }}>Submit ZK Proof</h3>
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-4)" }}>
          Submit a ZK proof to issue an on-chain attestation. Requires wallet connection.
        </p>

        {!address && (
          <EmptyState title="Wallet not connected" body="Connect your wallet to submit ZK proofs." />
        )}

        {address && (
          <>
            {/* Layer Toggle */}
            <div className="flex gap-2" style={{ marginBottom: "var(--space-4)" }}>
              <button
                className={`btn btn--${layer === "auth" ? "primary" : "ghost"} btn--sm`}
                onClick={() => setLayer("auth")}
              >
                Layer 1: Authenticity
              </button>
              <button
                className={`btn btn--${layer === "attribute" ? "primary" : "ghost"} btn--sm`}
                onClick={() => setLayer("attribute")}
              >
                Layer 2: Attribute
              </button>
            </div>

            <div className="grid gap-3" style={{ marginBottom: "var(--space-4)" }}>
              <div>
                <label className="t-xs c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>Verifier ID</label>
                <Input
                  mono
                  type="number"
                  value={verifierId}
                  onChange={(e) => setVerifierId(e.target.value)}
                  placeholder="0"
                  style={{ maxWidth: 120 }}
                />
              </div>
              <div>
                <label className="t-xs c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>Proof Hash (bytes32)</label>
                <Input
                  mono
                  type="text"
                  value={proofHash}
                  onChange={(e) => setProofHash(e.target.value)}
                  placeholder="0x..."
                />
              </div>

              {layer === "auth" && (
                <div>
                  <label className="t-xs c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>Document Type</label>
                  <select
                    className="select"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                  >
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                    <option value="drivers_license">Driver's License</option>
                    <option value="residence_permit">Residence Permit</option>
                  </select>
                </div>
              )}

              {layer === "attribute" && (
                <div>
                  <label className="t-xs c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>Attribute to Prove</label>
                  <Input
                    type="text"
                    value={attributeType}
                    onChange={(e) => setAttributeType(e.target.value)}
                    placeholder="e.g. age >= 18"
                  />
                </div>
              )}
            </div>

            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!proofHash || isPending}
            >
              {isPending ? "Submitting..." : layer === "auth" ? "Submit Authenticity Proof" : "Submit Attribute Proof"}
            </Button>

            {error && (
              <div style={{ marginTop: "var(--space-3)" }}><ErrorBanner>{error.message}</ErrorBanner></div>
            )}

            {data && (
              <Card style={{ marginTop: "var(--space-4)", background: "var(--color-surface-1)" }}>
                <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>Submitted Successfully</p>
                <div className="data-row">
                  <span className="data-row__label">TX Hash</span>
                  <span className="mono t-xs" style={{ color: "var(--color-verified)" }}>{data.txHash}</span>
                </div>
                <div className="data-row">
                  <span className="data-row__label">Claim ID</span>
                  <span className="mono t-xs" style={{ color: "var(--color-on-bright)" }}>{data.claimId}</span>
                </div>
                <div className="data-row">
                  <span className="data-row__label">Message</span>
                  <span className="t-sm">{data.message}</span>
                </div>
              </Card>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

// ── Status Tab ────────────────────────────────────────────────────────────

function StatusTab() {
  const [proofHash, setProofHash] = useState("");

  return (
    <div>
      <Card>
        <h3 className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-3)" }}>Check Proof Status</h3>
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-4)" }}>
          Check if a proof hash has already been used (replay protection).
        </p>

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label className="t-xs c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>Proof Hash</label>
          <Input
            mono
            type="text"
            value={proofHash}
            onChange={(e) => setProofHash(e.target.value)}
            placeholder="0x..."
          />
        </div>
      </Card>

      {proofHash && <ProofStatusCard proofHash={proofHash} />}
    </div>
  );
}

function ProofStatusCard({ proofHash }: { proofHash: string }) {
  const { data, isLoading, error } = useZKProofStatus(
    /^0x[0-9a-fA-F]{64}$/.test(proofHash) ? proofHash : undefined
  );

  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorBanner>{error.message}</ErrorBanner>;
  if (!data) return null;

  return (
    <Card style={{ marginTop: "var(--space-3)" }}>
      <div className="data-row">
        <span className="data-row__label">Proof Hash</span>
        <span className="mono t-xs" style={{ color: "var(--color-on-bright)", wordBreak: "break-all" }}>{data.proofHash}</span>
      </div>
      <div className="data-row">
        <span className="data-row__label">Status</span>
        <span className="t-sm" style={{ color: data.used ? "var(--color-danger)" : "var(--color-verified)" }}>
          {data.used ? "Used (cannot be replayed)" : "Available"}
        </span>
      </div>
      <div className="data-row">
        <span className="data-row__label">Message</span>
        <span className="t-sm">{data.message}</span>
      </div>
    </Card>
  );
}

// ── Vault Tab — Encrypted ID Vault ─────────────────────────────────────

const VAULT_PHASE_LABEL: Record<string, string> = {
  idle: "",
  ocr: "Reading MRZ (on-device OCR)…",
  key: "Deriving encryption key from wallet signature…",
  encrypting: "Encrypting (AES-256-GCM)…",
  uploading: "Pinning encrypted blob to IPFS…",
  committing: "Recording commitment on-chain…",
  done: "Committed",
  error: "Failed",
};

function VaultTab() {
  const { address } = useAccount();
  const vault = useZkVault();
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  // Face binding: ID portrait ↔ live selfie (+ registration avatar when set).
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [faceResult, setFaceResult] = useState<FaceMatchResult | null>(null);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { data: idHistory } = useIdentityHistory(address);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({
    documentType: "national_id",
    documentNumber: "",
    surname: "",
    givenNames: "",
    nationality: "",
    birthDate: "",
    expiryDate: "",
  });
  // Public badge endpoint — NO wallet signature, safe to query automatically.
  // NEVER auto-call vault.refreshStatus() (signed) in an effect/useQuery:
  // each call prompts a wallet signature, and an effect depending on an
  // unstable callback identity re-fires every render → 1000 queued prompts.
  const {
    data: badge,
    isLoading: statusLoading,
    refetch: refetchBadge,
  } = useVaultBadge(address);

  const onFile = (slot: "front" | "back", f: File | null) => {
    if (slot === "front") {
      setFront(f);
      setFrontPreview(f ? URL.createObjectURL(f) : null);
    } else {
      setBack(f);
      setBackPreview(f ? URL.createObjectURL(f) : null);
    }
    setShowManual(false);
    setFaceResult(null);
    setFaceError(null);
    vault.reset();
  };

  const clearFiles = () => {
    onFile("front", null);
    onFile("back", null);
  };

  // ── Face binding (who-is-who) ──────────────────────────────────────────
  // The document portrait must match a live selfie AND (when the wallet has
  // one) the registration avatar. All on-device; only the pass + distances
  // are stored in the vault fields. Commit stays blocked until it passes.

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (camOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [camOn]);

  const startCamera = async () => {
    setFaceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCamOn(true);
    } catch {
      setFaceError("Camera unavailable — allow camera access or upload a recent selfie-style photo instead.");
    }
  };

  const captureSelfie = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        setFaceError("Selfie capture failed — try again.");
        return;
      }
      const f = new File([blob], "selfie.jpg", { type: "image/jpeg" });
      setSelfie(f);
      setSelfiePreview(URL.createObjectURL(f));
      setFaceResult(null);
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  /** Registration avatar bytes via identity metadata (or null when unset). */
  const fetchAvatarBlob = async (): Promise<Blob | null> => {
    const uri = idHistory?.identity?.metadataUri;
    if (!uri) return null;
    const metaUrl = uri.startsWith("ipfs://")
      ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
      : uri;
    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json().catch(() => null)) as { image?: unknown } | null;
    if (!meta || typeof meta.image !== "string" || !meta.image) return null;
    const imgUrl = meta.image.startsWith("ipfs://")
      ? `https://gateway.pinata.cloud/ipfs/${meta.image.slice(7)}`
      : meta.image;
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return null;
    return imgRes.blob();
  };

  const runFaceCheck = async () => {
    if (!front) {
      setFaceError("Upload the front side first — the portrait lives there.");
      return;
    }
    if (!selfie) {
      setFaceError("Take a live selfie first.");
      return;
    }
    setFaceBusy(true);
    setFaceError(null);
    setFaceResult(null);
    try {
      const named: { name: string; descriptor: Float32Array }[] = [
        { name: "id", descriptor: await describeFace(await loadImageEl(front), "ID photo") },
        { name: "selfie", descriptor: await describeFace(await loadImageEl(selfie), "selfie") },
      ];
      try {
        const avatarBlob = await fetchAvatarBlob();
        if (avatarBlob) {
          named.push({ name: "avatar", descriptor: await describeFace(await loadImageEl(avatarBlob), "avatar") });
        }
      } catch {
        // Avatar unreadable — fall through to ID ↔ selfie only.
      }
      setFaceResult(matchDescriptors(named));
    } catch (err) {
      setFaceError((err as Error).message);
    } finally {
      setFaceBusy(false);
    }
  };

  /** Transparent face-bind signals stored in the vault fields on commit. */
  const faceFieldEntries = (result: FaceMatchResult | null): Record<string, string> => {
    if (!result?.pass) return {};
    const out: Record<string, string> = {
      faceMatch: "pass",
      faceThreshold: String(result.threshold),
    };
    for (const s of result.scores) out[`faceScore_${s.pair}`] = String(s.distance);
    return out;
  };

  const refreshBadge = useCallback(() => {
    void refetchBadge();
  }, [refetchBadge]);

  const handleCommit = async () => {
    // MRZ lives on the back side — OCR that, fall back to front if it's the only photo.
    const ocrFile = back ?? front;
    if (!ocrFile || !faceResult?.pass) return;
    try {
      await vault.commitVault(
        ocrFile,
        undefined,
        { ...(front ? { front } : {}), ...(back ? { back } : {}) },
        faceFieldEntries(faceResult)
      );
      refreshBadge();
    } catch {
      /* error already surfaced via vault.error */
    }
  };

  const handleManualCommit = async () => {
    const ocrFile = back ?? front;
    if (!ocrFile || !manual.documentNumber.trim() || !faceResult?.pass) return;
    try {
      const fields: Record<string, string> = Object.fromEntries(
        Object.entries(manual).map(([k, v]) => [k, v.trim()])
      );
      await vault.commitVault(
        ocrFile,
        fields,
        { ...(front ? { front } : {}), ...(back ? { back } : {}) },
        faceFieldEntries(faceResult)
      );
      refreshBadge();
    } catch {
      /* error already surfaced via vault.error */
    }
  };

  const handleDecrypt = async () => {
    if (!address) return;
    try {
      // CID is only in the signed (owner) status — user-initiated, so the
      // signature prompt is expected. Key derivation also signs by design.
      const cid = vault.commitResult?.vaultCid ?? (await vault.refreshStatus())?.vaultCid;
      if (!cid) throw new Error("No vault commitment found for this wallet");
      await vault.decryptVault(cid);
    } catch {
      /* error already surfaced via vault.error */
    }
  };

  if (!address) {
    return <EmptyState title="Wallet not connected" body="Connect your wallet to use the encrypted ID vault." />;
  }

  return (
    <div>
      <Callout type="info">
        Your document is read <strong>on-device</strong>, encrypted with a key derived from your wallet
        signature, and only the <strong>encrypted</strong> blob leaves the browser. The chain stores a
        commitment — never your data.
      </Callout>

      {/* Current commitment status (public badge — no signature needed) */}
      <Card style={{ marginTop: "var(--space-4)" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-2)", gap: "var(--space-2)" }}>
          <h3 className="t-sm" style={{ fontWeight: 600 }}>Vault Status</h3>
          <Button variant="ghost" size="sm" onClick={refreshBadge} loading={statusLoading}>
            Refresh
          </Button>
        </div>
        {!badge || !badge.committed ? (
          <p className="t-sm c-subtle">No vault committed for this wallet yet.</p>
        ) : (
          <>
            <div className="data-row">
              <span className="data-row__label">On-chain</span>
              <span className="t-sm" style={{ color: badge.isValid ? "var(--color-verified)" : "var(--color-danger)" }}>
                {badge.isValid ? "✓ Valid attestation" : "Attestation not valid/expired"}
              </span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Document</span>
              <span className="t-sm">{badge.documentType}</span>
            </div>
            {badge.committedAt && (
              <div className="data-row">
                <span className="data-row__label">Committed</span>
                <span className="t-sm">{new Date(badge.committedAt * 1000).toLocaleString()}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              style={{ marginTop: "var(--space-3)" }}
              onClick={() => void handleDecrypt()}
              loading={vault.phase === "key" || vault.phase === "encrypting"}
            >
              🔓 Decrypt &amp; view (signs once, local only)
            </Button>
          </>
        )}

        {vault.decrypted && (
          <Card style={{ marginTop: "var(--space-3)", background: "var(--color-surface-1)" }}>
            <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>Decrypted fields (never sent anywhere)</p>
            <div className="grid gap-1">
              {Object.entries(vault.decrypted.fields).map(([k, v]) => (
                <div key={k} className="data-row">
                  <span className="data-row__label">{k}</span>
                  <span className="mono t-xs">{v}</span>
                </div>
              ))}
            </div>
            {vault.decrypted.images && (vault.decrypted.images.front || vault.decrypted.images.back) && (
              <div className="grid gap-3 sm:grid-cols-2" style={{ marginTop: "var(--space-3)" }}>
                {vault.decrypted.images.front && (
                  <div>
                    <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-1)" }}>Front side</p>
                    <img src={vault.decrypted.images.front} alt="decrypted front side" style={{ maxHeight: 180, borderRadius: 8 }} />
                  </div>
                )}
                {vault.decrypted.images.back && (
                  <div>
                    <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-1)" }}>Back side</p>
                    <img src={vault.decrypted.images.back} alt="decrypted back side" style={{ maxHeight: 180, borderRadius: 8 }} />
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </Card>

      {/* Upload & commit flow */}
      <Card style={{ marginTop: "var(--space-4)" }}>
        <h3 className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-3)" }}>Scan or Upload Document</h3>
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-4)" }}>
          Upload both sides. The MRZ (back side) is read locally and its
          check digits validated — a format-level authenticity check.
          Both photos are encrypted on-device before leaving the browser.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["front", "Front side", frontPreview, "📷 Front (photo side)"],
            ["back", "Back side (MRZ)", backPreview, "📷 Back (MRZ side)"],
          ] as const).map(([slot, label, url, placeholder]) => (
            <div key={slot}>
              <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>{label}</p>
              <label
                style={{
                  display: "block",
                  border: "1px dashed var(--color-border, #444)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-5)",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "var(--color-surface-1)",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => onFile(slot, e.target.files?.[0] ?? null)}
                />
                {url ? (
                  <img src={url} alt={`${label} preview`} style={{ maxHeight: 180, margin: "0 auto", borderRadius: 8 }} />
                ) : (
                  <span className="t-sm c-subtle">{placeholder}</span>
                )}
              </label>
            </div>
          ))}
        </div>

        {vault.mrz && (
          <Card style={{ marginTop: "var(--space-3)", background: "var(--color-surface-1)" }}>
            <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>
              MRZ parsed — format {vault.mrz.format} {vault.mrz.allChecksValid ? "· all checksums ✓" : "· some checksums failed"}
            </p>
            <div className="grid gap-1">
              {Object.entries(vault.mrz.fields).map(([k, v]) => (
                <div key={k} className="data-row">
                  <span className="data-row__label">{k}</span>
                  <span className="mono t-xs">{v}</span>
                </div>
              ))
              }
            </div>
          </Card>
        )}

        {vault.isBusy && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-1)" }}>{VAULT_PHASE_LABEL[vault.phase]}</p>
            {vault.phase === "ocr" && (
              <div style={{ height: 4, borderRadius: 2, background: "var(--color-surface-1)", overflow: "hidden" }}>
                <div style={{ width: `${Math.round(vault.progress * 100)}%`, height: "100%", background: "var(--color-arc-primary)", transition: "width 0.2s" }} />
              </div>
            )}
          </div>
        )}

        {vault.error && (
          <div style={{ marginTop: "var(--space-3)" }}><ErrorBanner>{vault.error}</ErrorBanner></div>
        )}

        {/* Face binding — ID portrait must be the person committing it. */}
        {(front || back) && !vault.isBusy && (
          <Card style={{ marginTop: "var(--space-3)", background: "var(--color-surface-1)" }}>
            <p className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>
              Face check — are you this document&apos;s owner?
            </p>
            <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-3)" }}>
              The portrait on the document is matched on-device against a live selfie
              {idHistory?.identity?.metadataUri ? " and your registration avatar" : ""}.
              Every pair must score under {FACE_MATCH_THRESHOLD} (lower = same person) or commit stays blocked.
            </p>
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              {!camOn ? (
                <Button variant="ghost" size="sm" onClick={() => void startCamera()}>
                  📷 Take a live selfie
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => captureSelfie()}>
                  Capture
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void runFaceCheck()}
                disabled={!front || !selfie || faceBusy}
                loading={faceBusy}
              >
                Check face match
              </Button>
            </div>
            {camOn && (
              <video ref={videoRef} autoPlay playsInline muted style={{ marginTop: "var(--space-3)", maxHeight: 240, borderRadius: 8 }} />
            )}
            {selfiePreview && !camOn && (
              <img src={selfiePreview} alt="live selfie" style={{ marginTop: "var(--space-3)", maxHeight: 160, borderRadius: 8 }} />
            )}
            {faceError && (
              <div style={{ marginTop: "var(--space-3)" }}><ErrorBanner>{faceError}</ErrorBanner></div>
            )}
            {faceResult && (
              <div style={{ marginTop: "var(--space-3)" }}>
                {faceResult.scores.map((s) => (
                  <div key={s.pair} className="data-row">
                    <span className="data-row__label mono">{s.pair}</span>
                    <span className="mono t-xs" style={{ color: s.pass ? "var(--color-verified)" : "var(--color-danger, #f87171)" }}>
                      {s.distance.toFixed(3)} {s.pass ? "✓" : "✗"}
                    </span>
                  </div>
                ))}
                {!faceResult.pass && (
                  <p className="t-xs c-subtle" style={{ marginTop: "var(--space-2)" }}>
                    Faces don&apos;t match — commit is blocked. Retry with better light, no glasses/hat,
                    and the same person as the document portrait.
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        {(front || back) && !vault.isBusy && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <Button variant="ghost" size="sm" onClick={() => setShowManual((s) => !s)}>
              {showManual ? "Hide manual entry" : "No MRZ on your document? Enter details manually"}
            </Button>
            {showManual && (
              <div className="grid gap-3" style={{ marginTop: "var(--space-3)" }}>
                <p className="t-xs c-subtle">
                  US driver&apos;s licenses and state IDs have no ICAO MRZ — OCR can&apos;t read them.
                  Enter the fields yourself; they&apos;re still encrypted on-device before leaving the browser.
                </p>
                <div>
                  <label className="t-xs c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>Document Type</label>
                  <select
                    className="select"
                    value={manual.documentType}
                    onChange={(e) => setManual((m) => ({ ...m, documentType: e.target.value }))}
                  >
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                    <option value="drivers_license">Driver&apos;s License</option>
                    <option value="residence_permit">Residence Permit</option>
                  </select>
                </div>
                {([
                  ["documentNumber", "Document Number *"],
                  ["surname", "Surname"],
                  ["givenNames", "Given Names"],
                  ["nationality", "Nationality (3-letter code)"],
                  ["birthDate", "Birth Date"],
                  ["expiryDate", "Expiry Date"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="t-xs c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>{label}</label>
                    <Input
                      mono={key === "documentNumber"}
                      type="text"
                      value={manual[key]}
                      onChange={(e) => setManual((m) => ({ ...m, [key]: e.target.value }))}
                      placeholder={label}
                    />
                  </div>
                ))}
                <div>
                  <Button
                    variant="primary"
                    onClick={() => void handleManualCommit()}
                    disabled={!manual.documentNumber.trim() || !faceResult?.pass || vault.isBusy}
                    loading={vault.isBusy}
                  >
                    Encrypt &amp; Commit Manually
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2" style={{ marginTop: "var(--space-4)" }}>
          <Button variant="primary" onClick={() => void handleCommit()} disabled={!(front || back) || !faceResult?.pass || vault.isBusy} loading={vault.isBusy}>
            {vault.commitResult ? "Committed ✓" : "Encrypt & Commit"}
          </Button>
          {(front || back) && !vault.isBusy && (
            <Button variant="ghost" onClick={() => clearFiles()}>Clear</Button>
          )}
        </div>

        {vault.commitResult && (
          <Card style={{ marginTop: "var(--space-4)", background: "var(--color-surface-1)" }}>
            <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>Commitment recorded</p>
            <div className="data-row">
              <span className="data-row__label">TX Hash</span>
              <span className="mono t-xs" style={{ color: "var(--color-verified)", wordBreak: "break-all" }}>{vault.commitResult.txHash}</span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Vault CID</span>
              <span className="mono t-xs" style={{ wordBreak: "break-all" }}>{vault.commitResult.vaultCid}</span>
            </div>
            {vault.commitResult.claimId && (
              <div className="data-row">
                <span className="data-row__label">Claim ID</span>
                <span className="mono t-xs" style={{ wordBreak: "break-all" }}>{vault.commitResult.claimId}</span>
              </div>
            )}
          </Card>
        )}
      </Card>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <p className="t-xs c-subtle">{label}</p>
      <p className="mono t-2xl" style={{ color: color ?? "var(--color-on-bright)", marginTop: "var(--space-1)" }}>
        {value}
      </p>
    </Card>
  );
}

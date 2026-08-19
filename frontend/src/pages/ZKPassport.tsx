/**
 * ZKPassport.tsx — ZK Passport verification page.
 *
 * What it does: displays the ZK passport verification flow — list verifiers,
 *   submit proofs (Layer 1 authenticity + Layer 2 attribute proofs), check status.
 * What it does NOT do: generate ZK proofs (that happens on the user's device).
 */

import { useState } from "react";
import { useAccount } from "wagmi";
import { useZKVerifiers, useZKStats, useZKProofStatus, useSubmitPassportProof, useSubmitAttributeProof, useVerifyZKProof } from "../hooks/useZKProof";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { CardSkeleton } from "../components/ui/Skeleton";
import { AddressDisplay } from "../components/ui/AddressDisplay";

// ── Types ─────────────────────────────────────────────────────────────────

type Tab = "overview" | "verify" | "submit" | "status";

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
        {(["overview", "verify", "submit", "status"] as const).map((tab) => (
          <button
            key={tab}
            className={`btn btn--${activeTab === tab ? "primary" : "ghost"} btn--sm`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      {activeTab === "overview" && <OverviewTab />}
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

// ── Stat Card ─────────────────────────────────────────────────────────────

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

/**
 * DeveloperVerify — Standalone verification endpoint for third-party apps.
 *
 * This page provides a simple interface for developers to:
 * 1. Enter a wallet address
 * 2. Select a scoring policy
 * 3. See the trust score and pass/fail result
 * 4. Get the API response they can use in their own apps
 *
 * The actual verification happens via the backend API:
 * GET /v1/verify/:address?policy=default&threshold=20
 */

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { AddressDisplay } from "../components/ui/AddressDisplay";
import { API_BASE_URL } from "../config/api";

type VerificationResult = {
  passed: boolean;
  score: number;
  threshold: number;
  attestationCount: number;
  uniqueIssuers: number;
  activeCategories: string[];
  verifiedAt: number;
  breakdown?: {
    service: string;
    label: string;
    weight: number;
    claimCount: number;
    uniqueIssuers: number;
    score: number;
    maxPossible: number;
  }[];
};

type PolicyPreset = "default" | "high-security" | "low-friction";

const POLICY_PRESETS: { value: PolicyPreset; label: string; description: string; threshold: number }[] = [
  { value: "default", label: "Default", description: "Balanced scoring across all service categories", threshold: 20 },
  { value: "high-security", label: "High Security", description: "Requires KYC + identity + multiple categories", threshold: 40 },
  { value: "low-friction", label: "Low Friction", description: "Any 2+ categories with valid attestation", threshold: 10 },
];

export function DeveloperVerifyPage() {
  const { address: connectedAddress } = useAccount();
  const [targetAddress, setTargetAddress] = useState("");
  const [policy, setPolicy] = useState<PolicyPreset>("default");
  const [customThreshold, setCustomThreshold] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApi, setShowApi] = useState(false);

  const handleVerify = useCallback(async () => {
    const address = targetAddress.trim();
    if (!address.startsWith("0x") || address.length !== 42) {
      setError("Invalid Ethereum address");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({ policy });
      if (customThreshold) {
        params.set("threshold", customThreshold);
      }

      const response = await fetch(`${API_BASE_URL}/v1/verify/${address}?${params}`);
      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error?.message || "Verification failed");
      }

      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }, [targetAddress, policy, customThreshold]);

  const handleUseConnected = () => {
    if (connectedAddress) {
      setTargetAddress(connectedAddress);
    }
  };

  const getApiExample = () => {
    const address = targetAddress.trim() || "0x...";
    const params = new URLSearchParams({ policy });
    if (customThreshold) {
      params.set("threshold", customThreshold);
    }
    return `curl -X GET "${API_BASE_URL}/v1/verify/${address}?${params}"`;
  };

  return (
    <div className="animate-page">
      <PageHeader
        eyebrow="Developer API"
        title="Verify Wallet Trust Score"
        description="Check if a wallet address meets ArcPass's trust scoring threshold. Use this endpoint to gate access in your dApp."
      />

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Verification Form */}
        <Card>
          <div className="grid gap-4">
            <div>
              <label className="t-sm c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>
                Wallet Address
              </label>
              <div className="flex gap-2">
                <Input
                  mono
                  type="text"
                  placeholder="0x... enter address to verify"
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  aria-label="Wallet address to verify"
                  style={{ flex: 1 }}
                />
                {connectedAddress && (
                  <Button variant="ghost" onClick={handleUseConnected}>
                    Use connected
                  </Button>
                )}
              </div>
            </div>

            <div>
              <label className="t-sm c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>
                Scoring Policy
              </label>
              <div className="grid grid-cols-3 gap-2">
                {POLICY_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    className={`card ${policy === p.value ? "card--verified" : ""}`}
                    onClick={() => setPolicy(p.value)}
                    style={{
                      padding: "var(--space-3)",
                      textAlign: "left",
                      cursor: "pointer",
                      border: `1px solid ${policy === p.value ? "var(--color-verified)" : "var(--color-border)"}`,
                      background: "var(--color-surface-1)",
                    }}
                  >
                    <div className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>
                      {p.label}
                    </div>
                    <div className="t-xs c-subtle">{p.description}</div>
                    <div className="t-xs" style={{ marginTop: "var(--space-1)", color: "var(--color-primary)" }}>
                      Threshold: {p.threshold}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="t-sm c-subtle" style={{ display: "block", marginBottom: "var(--space-1)" }}>
                Custom Threshold (optional)
              </label>
              <Input
                type="number"
                placeholder={`Default: ${POLICY_PRESETS.find((p) => p.value === policy)?.threshold ?? 20}`}
                value={customThreshold}
                onChange={(e) => setCustomThreshold(e.target.value)}
                min="0"
                max="100"
                aria-label="Custom threshold"
                style={{ maxWidth: 200 }}
              />
              <div className="t-xs c-subtle" style={{ marginTop: "var(--space-1)" }}>
                Override the policy default threshold (0–100)
              </div>
            </div>

            <Button
              onClick={handleVerify}
              disabled={!targetAddress.trim() || loading}
              style={{ marginTop: "var(--space-2)" }}
            >
              {loading ? "Verifying..." : "Verify Address"}
            </Button>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <ErrorBanner>{error}</ErrorBanner>
          </div>
        )}

        {/* Result */}
        {result && (
          <Card style={{ marginTop: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
              <div>
                <p className="eyebrow">Verification Result</p>
                <AddressDisplay address={targetAddress} />
              </div>
              <div
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  background: result.passed ? "var(--color-verified)" : "var(--color-danger)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "var(--font-size-sm)",
                }}
              >
                {result.passed ? "PASSED" : "FAILED"}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4" style={{ marginBottom: "var(--space-4)" }}>
              <div style={{ textAlign: "center" }}>
                <div className="mono t-2xl" style={{ color: result.passed ? "var(--color-verified)" : "var(--color-warning)" }}>
                  {result.score}
                </div>
                <div className="t-xs c-subtle">Score</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="mono t-2xl">{result.threshold}</div>
                <div className="t-xs c-subtle">Threshold</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="mono t-2xl">{result.attestationCount}</div>
                <div className="t-xs c-subtle">Attestations</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="mono t-2xl">{result.uniqueIssuers}</div>
                <div className="t-xs c-subtle">Unique Issuers</div>
              </div>
            </div>

            {result.breakdown && result.breakdown.length > 0 && (
              <div style={{ marginBottom: "var(--space-4)" }}>
                <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>Category Breakdown</p>
                {result.breakdown.map((cat) => (
                  <div
                    key={cat.service}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "var(--space-1) 0",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <span className="t-sm">{cat.label}</span>
                    <span className="mono t-sm" style={{ color: cat.claimCount > 0 ? "var(--color-verified)" : "var(--color-subtle)" }}>
                      {cat.claimCount} claims · {cat.score.toFixed(1)} pts
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="t-xs c-subtle">
              Verified at: {new Date(result.verifiedAt).toLocaleString()}
            </div>
          </Card>
        )}

        {/* API Response */}
        {result && (
          <Card style={{ marginTop: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
              <p className="t-sm" style={{ fontWeight: 600 }}>API Response</p>
              <Button variant="ghost" size="sm" onClick={() => setShowApi(!showApi)}>
                {showApi ? "Hide" : "Show"} API Details
              </Button>
            </div>

            {showApi && (
              <div>
                <div style={{ marginBottom: "var(--space-3)" }}>
                  <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-1)" }}>cURL Example</p>
                  <pre
                    className="mono"
                    style={{
                      padding: "var(--space-2)",
                      background: "var(--color-surface-1)",
                      borderRadius: "var(--radius-sm)",
                      overflow: "auto",
                      fontSize: "var(--font-size-xs)",
                    }}
                  >
                    {getApiExample()}
                  </pre>
                </div>

                <div>
                  <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-1)" }}>JSON Response</p>
                  <pre
                    className="mono"
                    style={{
                      padding: "var(--space-2)",
                      background: "var(--color-surface-1)",
                      borderRadius: "var(--radius-sm)",
                      overflow: "auto",
                      fontSize: "var(--font-size-xs)",
                    }}
                  >
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <Card style={{ marginTop: "var(--space-4)" }}>
            <EmptyState
              title="Enter an address to verify"
              body="Enter a wallet address above and select a scoring policy to check its trust score against ArcPass attestations."
            />
          </Card>
        )}

        {/* Integration Guide */}
        <Card style={{ marginTop: "var(--space-6)" }}>
          <p className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-3)" }}>Integration Guide</p>
          <div className="grid gap-4">
            <div>
              <p className="t-xs" style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>1. Call the API</p>
              <pre
                className="mono"
                style={{
                  padding: "var(--space-2)",
                  background: "var(--color-surface-1)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--font-size-xs)",
                }}
              >
{`const response = await fetch(
  \`\${API_BASE_URL}/v1/verify/\${walletAddress}?policy=default\`
);
const { data } = await response.json();

if (data.passed) {
  // Grant access
} else {
  // Deny access
}`}
              </pre>
            </div>

            <div>
              <p className="t-xs" style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>2. Available Policies</p>
              <ul className="t-xs" style={{ paddingLeft: "var(--space-4)" }}>
                <li><code>default</code> — Balanced scoring (threshold: 20)</li>
                <li><code>high-security</code> — Requires KYC + identity (threshold: 40)</li>
                <li><code>low-friction</code> — Any 2+ categories (threshold: 10)</li>
              </ul>
            </div>

            <div>
              <p className="t-xs" style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>3. Custom Thresholds</p>
              <pre
                className="mono"
                style={{
                  padding: "var(--space-2)",
                  background: "var(--color-surface-1)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--font-size-xs)",
                }}
              >
{`// Override the policy threshold
const response = await fetch(
  \`\${API_BASE_URL}/v1/verify/\${address}?policy=default&threshold=30\`
);`}
              </pre>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

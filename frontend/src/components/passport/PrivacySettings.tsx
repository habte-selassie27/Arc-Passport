/**
 * PrivacySettings — GDPR erase button + data management.
 * Shows data summary and allows subject to erase their off-chain data.
 */

import { useState } from "react";
import { useSignMessage } from "wagmi";
import { useWallet } from "../../contexts/WalletContext";
import { signedFetch } from "../../utils/signedApi";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

export function PrivacySettings({ claimCount = 0 }: { claimCount?: number }) {
  const { address } = useWallet();
  const { signMessageAsync } = useSignMessage();
  const [phase, setPhase] = useState<"idle" | "confirm" | "done" | "error">("idle");
  const [erasing, setErasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ erased: number } | null>(null);

  const handleErase = async () => {
    if (!address) return;
    setErasing(true);
    setError(null);

    try {
      const data = await signedFetch<{ erased: number; message: string }>({
        path: `/identity/${address}/data`,
        address,
        signMessage: signMessageAsync,
        method: "DELETE",
      });
      setResult({ erased: data.erased });
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    } finally {
      setErasing(false);
    }
  };

  if (phase === "done" && result) {
    return (
      <Card>
        <div style={{ padding: "var(--space-4)", textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>✓</div>
          <p className="t-sm" style={{ fontWeight: 600, color: "var(--color-verified)", marginBottom: "var(--space-1)" }}>
            Data erased
          </p>
          <p className="t-xs c-subtle">
            {result.erased} claim(s) affected. On-chain commitments remain as orphaned hashes — the audit trail is preserved but the data is no longer verifiable.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ padding: "var(--space-4)" }}>
        <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Privacy & Data</p>
        <p className="t-sm c-subtle" style={{ marginBottom: "var(--space-4)" }}>
          Erase your off-chain data. On-chain commitments become orphaned hashes — the audit trail that a claim existed remains, but it is no longer verifiable. This action cannot be undone.
        </p>

        {phase === "confirm" && (
          <div
            style={{
              padding: "var(--space-3)",
              borderRadius: "var(--radius-md)",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              marginBottom: "var(--space-3)",
            }}
          >
            <p className="t-xs" style={{ color: "var(--color-danger)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
              Are you sure?
            </p>
            <p className="t-xs c-subtle">
              This will erase all off-chain data for your wallet ({claimCount} claim(s)). You will need to re-register to restore your profile.
            </p>
          </div>
        )}

        {error && (
          <p className="t-xs" style={{ color: "var(--color-danger)", marginBottom: "var(--space-3)" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {phase === "confirm" ? (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={handleErase}
                disabled={erasing}
              >
                {erasing ? <><Spinner size={12} /> Erasing…</> : "Yes, erase my data"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPhase("idle")}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setPhase("confirm")}
              disabled={erasing}
            >
              Erase all data
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

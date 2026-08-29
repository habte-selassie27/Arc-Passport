/**
 * PrivacyAndData — one combined section: credential field privacy
 * (selective disclosure) + GDPR erase, collapsed by default.
 */

import { useState, useCallback } from "react";
import { useSignMessage } from "wagmi";
import { useWallet } from "../../contexts/WalletContext";
import { useFieldProof, type ClaimFieldClassification } from "../../hooks/useFieldProof";
import { signedFetch } from "../../utils/signedApi";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

interface ClaimDisclosure {
  claimId: string;
  schemaName: string;
  issuer: string;
  fields: ClaimFieldClassification[];
}

const CLASSIFICATION_STYLES: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  PUBLIC:  { bg: "rgba(0,229,160,0.12)",  color: "#00E5A0", label: "Public",  icon: "👁️" },
  PRIVATE: { bg: "rgba(239,68,68,0.12)",   color: "#EF4444", label: "Private", icon: "🔒" },
  DERIVED: { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", label: "Derived", icon: "⚡" },
};

function ClassificationBadge({ classification }: { classification: string }) {
  const style = CLASSIFICATION_STYLES[classification] || CLASSIFICATION_STYLES.PUBLIC;
  return (
    <span
      style={{
        fontSize: "0.625rem",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "var(--radius-sm)",
        background: style.bg,
        color: style.color,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
      }}
    >
      <span>{style.icon}</span>
      {style.label}
    </span>
  );
}

export function DisclosureConfig({ claims }: { claims: Array<{ claimId: string; schemaName: string; issuer: string }> }) {
  const { address } = useWallet();
  const { signMessageAsync } = useSignMessage();
  const { fetchFields, loading } = useFieldProof();
  const [disclosures, setDisclosures] = useState<Record<string, ClaimDisclosure>>({});
  const [loadingClaim, setLoadingClaim] = useState<string | null>(null);

  // ── Erase state ──
  const [erasePhase, setErasePhase] = useState<"idle" | "confirm" | "done">("idle");
  const [erasing, setErasing] = useState(false);

  const handleLoadFields = useCallback(
    async (claimId: string) => {
      if (!address) return;
      setLoadingClaim(claimId);
      try {
        const fields = await fetchFields(claimId, address, signMessageAsync);
        const claim = claims.find((c) => c.claimId === claimId);
        if (claim && fields.length > 0) {
          setDisclosures((prev) => ({
            ...prev,
            [claimId]: { claimId, schemaName: claim.schemaName, issuer: claim.issuer, fields },
          }));
        }
      } finally {
        setLoadingClaim(null);
      }
    },
    [address, signMessageAsync, fetchFields, claims]
  );

  const handleLoadAll = useCallback(async () => {
    for (const claim of claims) {
      if (!disclosures[claim.claimId]) {
        await handleLoadFields(claim.claimId);
      }
    }
  }, [claims, disclosures, handleLoadFields]);

  const handleErase = async () => {
    if (!address || erasing) return;
    setErasing(true);
    try {
      await signedFetch({
        path: `/identity/${address}/data`,
        address,
        signMessage: signMessageAsync,
        method: "DELETE",
      });
      setErasePhase("done");
    } catch {
      /* keep confirm state; error surfaces via button re-click */
    } finally {
      setErasing(false);
    }
  };

  const loadedCount = Object.keys(disclosures).length;
  const allLoaded = loadedCount === claims.length;

  return (
    <details style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-surface-1)" }}>
      <summary
        style={{
          padding: "var(--space-3) var(--space-4)",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "var(--text-sm)",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        <span>🔒</span>
        <span style={{ flex: 1 }}>Privacy & Data</span>
        {erasePhase === "done" ? (
          <span className="t-xs" style={{ color: "var(--color-verified)", fontWeight: 400 }}>✓ erased</span>
        ) : (
          loadedCount > 0 && (
            <span className="t-xs c-subtle" style={{ fontWeight: 400 }}>
              {loadedCount}/{claims.length} inspected
            </span>
          )
        )}
      </summary>

      {erasePhase === "done" ? (
        <div style={{ padding: "var(--space-4)" }}>
          <p className="t-sm" style={{ fontWeight: 600, color: "var(--color-verified)", marginBottom: "var(--space-1)" }}>
            Data erased
          </p>
          <p className="t-xs c-subtle">
            On-chain commitments remain as orphaned hashes — the audit trail is preserved but the data is no longer verifiable. Reload the page to see your updated passport.
          </p>
        </div>
      ) : (
        <div style={{ padding: "0 var(--space-4) var(--space-4)" }}>
          {/* ── Field privacy ── */}
          <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Credential fields</p>
          <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-3)", lineHeight: 1.5 }}>
            Each credential has fields classified as Public (visible to everyone), Private (requires your signed permission), or Derived (computed, never stored).
          </p>

          {claims.length === 0 ? (
            <p className="t-xs c-subtle" style={{ padding: "var(--space-3)", textAlign: "center" }}>
              No credentials yet — nothing to inspect.
            </p>
          ) : (
            <>
              {!allLoaded && (
                <div style={{ marginBottom: "var(--space-3)" }}>
                  <Button size="sm" onClick={handleLoadAll} disabled={loading}>
                    {loading ? <><Spinner size={12} /> Loading…</> : "Inspect all fields"}
                  </Button>
                </div>
              )}

              <div className="grid gap-2">
                {claims.map((claim) => {
                  const disclosure = disclosures[claim.claimId];
                  const isLoadingThis = loadingClaim === claim.claimId;

                  return (
                    <div
                      key={claim.claimId}
                      style={{
                        padding: "var(--space-2) var(--space-3)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)",
                        background: disclosure ? "rgba(0,229,160,0.02)" : "transparent",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
                        <p className="t-xs" style={{ fontWeight: 500, color: "var(--color-on-surface)", flex: 1, minWidth: 0 }}>
                          {claim.schemaName}
                        </p>
                        {!disclosure ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleLoadFields(claim.claimId)}
                            disabled={isLoadingThis}
                          >
                            {isLoadingThis ? <Spinner size={12} /> : "Inspect"}
                          </Button>
                        ) : (
                          <div style={{ display: "flex", gap: "var(--space-1)", flexShrink: 0 }}>
                            {disclosure.fields.some((f) => f.classification === "PUBLIC") && (
                              <span className="t-xs" style={{ color: "var(--color-verified)" }}>
                                👁️ {disclosure.fields.filter((f) => f.classification === "PUBLIC").length}
                              </span>
                            )}
                            {disclosure.fields.some((f) => f.classification === "PRIVATE") && (
                              <span className="t-xs" style={{ color: "var(--color-danger)" }}>
                                🔒 {disclosure.fields.filter((f) => f.classification === "PRIVATE").length}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {disclosure && (
                        <div className="grid gap-1" style={{ marginTop: "var(--space-1)" }}>
                          {disclosure.fields.map((field) => (
                            <div
                              key={field.name}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "2px var(--space-2)",
                                borderRadius: "var(--radius-sm)",
                                background: "var(--color-surface-0)",
                              }}
                            >
                              <span className="t-xs" style={{ color: "var(--color-on-surface)" }}>{field.name}</span>
                              <ClassificationBadge classification={field.classification} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Erase data ── */}
          <div style={{ marginTop: "var(--space-5)" }}>
            <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Erase off-chain data</p>
            <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-3)", lineHeight: 1.5 }}>
              Delete your off-chain metadata. On-chain commitments become orphaned hashes — the audit trail remains, but is no longer verifiable. This cannot be undone.
            </p>

            {erasePhase === "confirm" && (
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
                  This erases all off-chain data for your wallet ({claims.length} credential{claims.length !== 1 ? "s" : ""}). You will need to re-register to restore your profile.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              {erasePhase === "confirm" ? (
                <>
                  <Button size="sm" variant="danger" onClick={() => void handleErase()} disabled={erasing}>
                    {erasing ? <><Spinner size={12} /> Erasing…</> : "Yes, erase my data"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setErasePhase("idle")}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setErasePhase("confirm")}>
                  Erase my data
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </details>
  );
}

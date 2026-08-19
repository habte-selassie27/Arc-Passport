/**
 * DisclosureConfig — Selective disclosure settings.
 * Shows all claims and their field classifications (PUBLIC/PRIVATE/DERIVED).
 * Allows the user to see what's visible on their public passport.
 */

import { useState, useCallback } from "react";
import { useSignMessage } from "wagmi";
import { useWallet } from "../../contexts/WalletContext";
import { useFieldProof, type ClaimFieldClassification } from "../../hooks/useFieldProof";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

interface ClaimDisclosure {
  claimId: string;
  schemaName: string;
  issuer: string;
  fields: ClaimFieldClassification[];
}

const CLASSIFICATION_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PUBLIC:   { bg: "rgba(0,229,160,0.15)", color: "#00E5A0", label: "Public" },
  PRIVATE:  { bg: "rgba(239,68,68,0.15)", color: "#EF4444", label: "Private" },
  DERIVED:  { bg: "rgba(245,158,11,0.15)", color: "#F59E0B", label: "Derived" },
};

function ClassificationBadge({ classification }: { classification: string }) {
  const style = CLASSIFICATION_STYLES[classification] || CLASSIFICATION_STYLES.PUBLIC;
  return (
    <span
      style={{
        fontSize: "0.6rem",
        fontWeight: 600,
        padding: "2px 6px",
        borderRadius: "var(--radius-sm)",
        background: style.bg,
        color: style.color,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
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

  const loadedCount = Object.keys(disclosures).length;
  const totalPublic = Object.values(disclosures).reduce(
    (sum, d) => sum + d.fields.filter((f) => f.classification === "PUBLIC").length,
    0
  );
  const totalPrivate = Object.values(disclosures).reduce(
    (sum, d) => sum + d.fields.filter((f) => f.classification === "PRIVATE").length,
    0
  );

  return (
    <Card>
      <div style={{ padding: "var(--space-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-3)" }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: "var(--space-1)" }}>Selective Disclosure</p>
            <p className="t-xs c-subtle">
              Control which fields are visible on your public passport. Public fields are shown to everyone; Private fields require a signed disclosure request.
            </p>
          </div>
          {loadedCount > 0 && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p className="t-xs mono" style={{ color: "var(--color-verified)" }}>{totalPublic} public</p>
              <p className="t-xs mono" style={{ color: "var(--color-danger)" }}>{totalPrivate} private</p>
            </div>
          )}
        </div>

        {claims.length === 0 ? (
          <p className="t-xs c-subtle" style={{ padding: "var(--space-4) 0", textAlign: "center" }}>
            No claims yet. Credentials will appear here once issued.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <Button size="sm" onClick={handleLoadAll} disabled={loading || loadedCount === claims.length}>
                {loading ? <><Spinner size={12} /> Loading…</> : loadedCount === claims.length ? "All loaded" : "Load all fields"}
              </Button>
            </div>

            <div className="grid gap-2">
              {claims.map((claim) => {
                const disclosure = disclosures[claim.claimId];
                const isLoadingThis = loadingClaim === claim.claimId;

                return (
                  <div
                    key={claim.claimId}
                    style={{
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      background: disclosure ? "rgba(0,229,160,0.02)" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: disclosure ? "var(--space-2)" : 0 }}>
                      <div>
                        <p className="t-sm" style={{ fontWeight: 500 }}>{claim.schemaName}</p>
                        <p className="t-xs mono c-subtle">{claim.claimId.slice(0, 16)}…</p>
                      </div>
                      {!disclosure && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleLoadFields(claim.claimId)}
                          disabled={isLoadingThis}
                        >
                          {isLoadingThis ? <Spinner size={12} /> : "Load fields"}
                        </Button>
                      )}
                    </div>

                    {disclosure && (
                      <div className="grid gap-1">
                        {disclosure.fields.map((field) => (
                          <div
                            key={field.name}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "var(--space-1) var(--space-2)",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--color-surface-0)",
                            }}
                          >
                            <span className="t-xs mono">{field.name}</span>
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
      </div>
    </Card>
  );
}

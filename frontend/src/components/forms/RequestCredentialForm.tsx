import { useEffect, useState, useMemo } from "react";
import { useRequests, fetchSchemaCatalog, type SchemaOption } from "../../hooks/useRequests";
import { useIssuers, type OnChainIssuer } from "../../hooks/useIssuers";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { LogoMark } from "../ui/LogoMark";
import { AddressDisplay } from "../ui/AddressDisplay";

const SERVICE_DISPLAY: Record<string, { label: string; icon: string; color: string; description: string }> = {
  kyc:         { label: "KYC / Compliance",      icon: "🛡️", color: "#00E5A0", description: "Identity verification, AML screening, age gate" },
  credentials: { label: "Professional",          icon: "📜", color: "#8B5CF6", description: "Certifications, skills, endorsements" },
  employment:  { label: "Employment",            icon: "💼", color: "#06B6D4", description: "Work history, role verification" },
  education:   { label: "Education",             icon: "🎓", color: "#10B981", description: "Degrees, courses, academic records" },
  dao:         { label: "DAO & Governance",      icon: "🏛️", color: "#F59E0B", description: "DAO membership, voting weight, roles" },
  reputation:  { label: "Reputation",            icon: "⭐", color: "#EC4899", description: "Community standing, contribution scores" },
  social:      { label: "Social",                icon: "🔗", color: "#F97316", description: "Social account links, follower verification" },
  identity:    { label: "Identity",              icon: "🪪", color: "#3B82F6", description: "Basic identity record, liveness check" },
  custom:      { label: "Custom",                icon: "✨", color: "#6366F1", description: "Custom attestation type" },
};

const CREDENTIAL_SERVICE_ORDER = ["kyc", "credentials", "employment", "education", "dao", "reputation", "social", "identity", "custom"];

export function RequestCredentialForm({ address }: { address: `0x${string}` }) {
  const { create, isLoading, error } = useRequests(address);
  const { issuers: onChainIssuers, loading: issuersLoading } = useIssuers();
  const [schemas, setSchemas] = useState<SchemaOption[]>([]);
  const [step, setStep] = useState<"type" | "issuer">("type");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedIssuer, setSelectedIssuer] = useState<OnChainIssuer | null>(null);
  const [customIssuer, setCustomIssuer] = useState("");
  const [selectedSchema, setSelectedSchema] = useState<string>("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "success">("idle");

  useEffect(() => {
    void fetchSchemaCatalog().then((s) => setSchemas(s));
  }, []);

  const schemasForType = useMemo(() => {
    if (!selectedService) return [];
    return schemas.filter((s) => s.service === selectedService);
  }, [schemas, selectedService]);

  const issuersForType = useMemo(() => {
    if (!selectedService) return [];
    return onChainIssuers.filter((i) => i.credentialTypes.includes(selectedService));
  }, [onChainIssuers, selectedService]);

  const servicesWithIssuers = useMemo(() => {
    const set = new Set<string>();
    for (const issuer of onChainIssuers) {
      for (const t of issuer.credentialTypes) set.add(t);
    }
    return CREDENTIAL_SERVICE_ORDER.filter((s) => set.has(s));
  }, [onChainIssuers]);

  const handleSelectType = (serviceKey: string) => {
    setSelectedService(serviceKey);
    setSelectedIssuer(null);
    setCustomIssuer("");
    setSelectedSchema("");
    setStep("issuer");
  };

  const handleSelectIssuer = (issuer: OnChainIssuer) => {
    setSelectedIssuer(issuer);
    if (schemasForType.length > 0) {
      setSelectedSchema(schemasForType[0].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssuer && !customIssuer) return;
    if (!selectedSchema) return;

    const issuerAddress = selectedIssuer?.address || customIssuer;
    setStatus("idle");
    const ok = await create({ issuer: issuerAddress, schemaId: selectedSchema, note });
    if (ok) {
      setStatus("success");
      setNote("");
    }
  };

  const handleBack = () => {
    setStep("type");
    setSelectedService("");
    setSelectedIssuer(null);
    setCustomIssuer("");
    setSelectedSchema("");
  };

  const canSubmit = (selectedIssuer || customIssuer) && selectedSchema;

  return (
    <Card id="request-credential">
      <div style={{ padding: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
          {step === "issuer" && (
            <button
              type="button"
              onClick={handleBack}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-muted)",
                padding: "2px",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
                lineHeight: 1,
              }}
              aria-label="Back to credential types"
            >
              ←
            </button>
          )}
          <h3 className="display--medium t-lg">Request a credential</h3>
        </div>
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-4)" }}>
          {step === "type"
            ? "What kind of credential do you need? Choose a category to see available issuers."
            : `Choose an issuer for ${SERVICE_DISPLAY[selectedService]?.label || selectedService}:`}
        </p>

        {step === "type" && (
          <div className="grid gap-2">
            {issuersLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-6)", gap: "var(--space-2)" }}>
                <Spinner size={16} />
                <span className="t-xs c-subtle">Loading on-chain issuers…</span>
              </div>
            ) : servicesWithIssuers.length === 0 ? (
              <div style={{ padding: "var(--space-6) var(--space-4)", textAlign: "center" }}>
                <p className="t-xs c-subtle">No on-chain issuers registered yet. Issuers will appear here once they are granted ISSUER_ROLE on the AttestationRegistry contract.</p>
              </div>
            ) : (
              servicesWithIssuers.map((serviceKey) => {
                const display = SERVICE_DISPLAY[serviceKey];
                if (!display) return null;
                const count = onChainIssuers.filter((i) => i.credentialTypes.includes(serviceKey)).length;

                return (
                  <button
                    key={serviceKey}
                    type="button"
                    onClick={() => handleSelectType(serviceKey)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3) var(--space-4)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color var(--duration-fast) var(--ease-out-quart), background var(--duration-fast) var(--ease-out-quart)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = display.color;
                      e.currentTarget.style.background = `${display.color}08`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-border)";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>{display.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="t-sm" style={{ fontWeight: 600, color: "var(--color-on-bright)" }}>{display.label}</p>
                      <p className="t-xs c-subtle">{display.description}</p>
                    </div>
                    <span className="t-xs c-subtle" style={{ flexShrink: 0 }}>
                      {count} issuer{count !== 1 ? "s" : ""}
                    </span>
                    <span style={{ color: "var(--color-subtle)", flexShrink: 0 }}>→</span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {step === "issuer" && (
          <form onSubmit={handleSubmit} className="grid gap-3">
            {issuersForType.length > 0 && (
              <div className="grid gap-2">
                {issuersForType.map((issuer) => {
                  const isSelected = selectedIssuer?.address === issuer.address;
                  return (
                    <button
                      key={issuer.address}
                      type="button"
                      onClick={() => handleSelectIssuer(issuer)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-3) var(--space-4)",
                        border: `1px solid ${isSelected ? "var(--color-verified)" : "var(--color-border)"}`,
                        borderRadius: "var(--radius-md)",
                        background: isSelected ? "rgba(0,229,160,0.06)" : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all var(--duration-fast) var(--ease-out-quart)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "var(--color-border-glow)";
                          e.currentTarget.style.background = "var(--color-surface-1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "var(--color-border)";
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "var(--radius-md)",
                          background: "var(--color-surface-1)",
                          border: "1px solid var(--color-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          flexShrink: 0,
                        }}
                      >
                        <LogoMark size={18} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="t-sm mono" style={{ fontWeight: 600, color: "var(--color-on-bright)", fontSize: "0.8rem" }}>
                          <AddressDisplay address={issuer.address} />
                        </p>
                        <p className="t-xs c-subtle" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {issuer.credentialTypes.length} credential type{issuer.credentialTypes.length !== 1 ? "s" : ""}
                          {" · "}
                          {issuer.credentialTypes.map((t) => SERVICE_DISPLAY[t]?.label ?? t).join(", ")}
                        </p>
                      </div>
                      {isSelected && (
                        <span style={{ color: "var(--color-verified)", fontWeight: 700 }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                border: `1px solid ${!selectedIssuer && customIssuer ? "var(--color-arc-primary)" : "var(--color-border)"}`,
                borderRadius: "var(--radius-md)",
                background: !selectedIssuer && customIssuer ? "rgba(59,130,246,0.06)" : "transparent",
              }}
            >
              <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>
                Or enter a custom issuer address:
              </p>
              <input
                type="text"
                value={customIssuer}
                onChange={(e) => {
                  setCustomIssuer(e.target.value);
                  if (e.target.value) setSelectedIssuer(null);
                }}
                placeholder="0x... issuer wallet address"
                className="input mono"
                style={{
                  width: "100%",
                  padding: "var(--space-2) var(--space-3)",
                  fontSize: "var(--text-xs)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  color: "var(--color-on-surface)",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>

            {schemasForType.length > 1 && (
              <div>
                <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-1)" }}>Credential variant:</p>
                <div className="flex flex-wrap gap-1">
                  {schemasForType.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSchema(s.id)}
                      className={`chip ${selectedSchema === s.id ? "chip--valid" : "chip--muted"}`}
                      style={{ cursor: "pointer" }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-1)" }}>Note to issuer (optional):</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Why are you requesting this credential?"
                style={{
                  width: "100%",
                  padding: "var(--space-2) var(--space-3)",
                  fontSize: "var(--text-xs)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  color: "var(--color-on-surface)",
                  resize: "vertical",
                }}
              />
            </div>

            {error && <p className="c-danger t-xs text-center">{error}</p>}
            {status === "success" && (
              <div
                style={{
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(0,229,160,0.06)",
                  border: "1px solid rgba(0,229,160,0.2)",
                  textAlign: "center",
                }}
              >
                <p className="t-sm" style={{ fontWeight: 600, color: "var(--color-verified)" }}>
                  ✓ Request sent!
                </p>
                <p className="t-xs c-subtle" style={{ marginTop: "var(--space-1)" }}>
                  The issuer will review your request on their dashboard.
                </p>
              </div>
            )}

            <Button
              type="submit"
              block
              disabled={!canSubmit || isLoading}
              loading={isLoading}
            >
              {selectedIssuer
                ? "Request credential"
                : customIssuer
                  ? "Request credential"
                  : "Select an issuer first"}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

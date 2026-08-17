import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { ServiceBadge } from "../../components/passport/ServiceBadge";
import { ALL_SERVICE_KEYS, SERVICE_LABELS, type ServiceKey } from "../../types/passport";
import { apiUrl, API_BASE_URL } from "../../config/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { EmptyState } from "../../components/ui/EmptyState";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";

const SERVICE_DESCRIPTIONS: Record<ServiceKey, string> = {
  identity: "View identity and passport registration status.",
  kyc: "Check KYC, AML, accredited investor, and age-gate verification status.",
  credentials: "View professional certifications, licenses, and skill endorsements.",
  dao: "Check DAO membership and governance participation status.",
  reputation: "View reputation scores, interactions, and dispute records.",
  employment: "Check employment history, income verification, and contractor records.",
  education: "View degrees, course completions, and bootcamp graduations.",
  social: "Check social account links, humanity proofs, and follower milestones.",
  custom: "View custom attestation claims.",
};

interface PassportView {
  address: string;
  services: Record<ServiceKey, { verified: boolean; claimCount: number; claims: { claimId: string; schemaId: string; issuer: string; valid: boolean }[] }>;
  generatedAt: number;
}

export function ServiceVerifyPage() {
  const { service: serviceParam } = useParams<{ service: string }>();
  const service = (serviceParam ?? "kyc") as ServiceKey;
  const { address: connected } = useAccount();
  const [input, setInput] = useState(connected ?? "");
  const [result, setResult] = useState<PassportView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = SERVICE_LABELS[service] ?? service;
  const description = SERVICE_DESCRIPTIONS[service] ?? "";

  const verify = async () => {
    if (!isAddress(input)) {
      setError("Invalid address");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(apiUrl(`/passport/${input}`));
      if (!res.ok) {
        throw new Error(res.status === 502 ? `Backend at ${API_BASE_URL} may be offline` : `Request failed: ${res.status}`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Lookup failed");
      setResult(json.data);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader eyebrow="Service verification" title={title} description={description} align="left" />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <Input
          mono
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x... subject address"
          aria-label="Subject address"
          style={{ flex: 1 }}
        />
        <Button type="submit" variant="primary" disabled={loading} loading={loading}>
          Look up
        </Button>
      </form>

      {error && (
        <ErrorBanner onRetry={() => void verify()}>
          {error}
        </ErrorBanner>
      )}

      {loading && !result && (
        <Card style={{ textAlign: "center", padding: "var(--space-10)" }}>
          <Spinner size={20} style={{ margin: "0 auto var(--space-4)", display: "block" }} aria-hidden="true" />
          <p className="c-subtle t-sm">Looking up on-chain passport…</p>
        </Card>
      )}

      {result && (
        <Card>
          <p className="mono t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>{result.address}</p>
          <p className="display--medium t-lg" style={{ marginBottom: "var(--space-3)" }}>{title}</p>

          <div className="flex flex-wrap gap-2" style={{ marginBottom: "var(--space-4)" }}>
            {ALL_SERVICE_KEYS.map((key) => {
              const svc = result.services?.[key] ?? { verified: false, claimCount: 0, claims: [] };
              const isCurrentService = key === service;
              return (
                <div key={key}>
                  <ServiceBadge name={key} verified={isCurrentService && svc.verified} claimCount={isCurrentService ? svc.claimCount : 0} />
                </div>
              );
            })}
          </div>

          {result.services?.[service]?.claims?.length > 0 && (
            <div>
              <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Claims</p>
              <div className="space-y-2">
                {result.services[service].claims.map((c) => (
                  <div
                    key={c.claimId}
                    className="mono t-xs"
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      background: "var(--color-surface-1)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span className={c.valid ? "c-verified" : "c-danger"} aria-hidden="true">
                      {c.valid ? "✓" : "✗"}
                    </span>
                    {c.claimId.slice(0, 18)}...
                    <span className="c-subtle">issuer:</span> {c.issuer.slice(0, 10)}...
                  </div>
                ))}
              </div>
            </div>
          )}

          {!result.services?.[service]?.claims?.length && (
            <EmptyState
              title="No claims found"
              body={`No ${SERVICE_LABELS[service]?.toLowerCase() ?? service} claims found for this address.`}
            />
          )}
        </Card>
      )}
    </div>
  );
}

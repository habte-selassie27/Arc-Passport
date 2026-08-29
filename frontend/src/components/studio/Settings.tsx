import { useEffect, useState } from "react";
import { ALL_SERVICE_KEYS, SERVICE_LABELS, type ServiceKey } from "../../types/passport";
import { Card } from "../ui/Card";

interface WalletStatus {
  configured: boolean;
  walletId: string | null;
}

interface SettingsData {
  services: Record<string, WalletStatus>;
  configuredCount: number;
  totalCount: number;
  blockchain: string;
}

export function Settings() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001"}/v1/settings/status`);
        const json = await res.json();
        if (json.success) setData(json.data);
        else setError("Failed to load settings");
      } catch (err) {
        setError((err as Error).message);
      }
    };
    fetchStatus();
  }, []);

  return (
    <Card>
      <h3 className="display--medium t-lg" style={{ marginBottom: "var(--space-2)" }}>Issuer Settings</h3>
      <p className="t-sm c-muted" style={{ marginBottom: "var(--space-4)" }}>
        Per-service issuer wallet status. Configured via backend Circle wallets.
      </p>

      {error && (
        <p className="t-sm" style={{ color: "var(--color-danger)", marginBottom: "var(--space-4)" }}>Failed to fetch</p>
      )}

      {data && (
        <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-4)" }}>
          {data.configuredCount}/{data.totalCount} services configured · Chain: {data.blockchain}
        </p>
      )}

      <div className="space-y-2">
        {ALL_SERVICE_KEYS.map((key: ServiceKey) => {
          const svc = data?.services?.[key];
          const configured = svc?.configured ?? false;
          return (
            <div
              key={key}
              className="flex items-center justify-between"
              style={{
                padding: "var(--space-3) var(--space-4)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                background: configured ? "rgba(0,229,160,0.03)" : "transparent",
              }}
            >
              <div>
                <p className="t-sm" style={{ fontWeight: 500, color: "var(--color-on-surface)" }}>{SERVICE_LABELS[key]}</p>
                <p className="mono t-xs c-subtle">CIRCLE_{key.toUpperCase()}_ISSUER_WALLET_ID</p>
              </div>
              <span className={`flex items-center gap-2 ${configured ? "chip--configured" : "chip--muted"}`} style={{ fontSize: "var(--text-xs)" }}>
                <span className={`dot ${configured ? "dot--on" : "dot--off"}`} aria-hidden="true" />
                {configured ? "configured" : "not configured"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

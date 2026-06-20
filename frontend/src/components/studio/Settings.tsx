import { useEffect, useState } from "react";
import { ALL_SERVICE_KEYS, SERVICE_LABELS, type ServiceKey } from "../../types/passport";

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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Issuer Settings</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Per-service issuer wallet status. Configured via backend Circle wallets.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {data && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {data.configuredCount}/{data.totalCount} services configured &middot; Chain: {data.blockchain}
        </p>
      )}

      <div className="space-y-2">
        {ALL_SERVICE_KEYS.map((key: ServiceKey) => {
          const svc = data?.services?.[key];
          const configured = svc?.configured ?? false;
          return (
            <div
              key={key}
              className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{SERVICE_LABELS[key]}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  CIRCLE_{key.toUpperCase()}_ISSUER_WALLET_ID
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  configured
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {configured ? "configured" : "not configured"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

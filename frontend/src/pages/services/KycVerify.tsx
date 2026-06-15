import { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { ServiceBadge } from "../../components/passport/ServiceBadge";
import { ALL_SERVICE_KEYS, SERVICE_LABELS, type ServiceKey } from "../../types/passport";
import { apiUrl, API_BASE_URL } from "../../config/api";

interface PassportView {
  address:     string;
  identityId:  number;
  services:    Record<ServiceKey, { verified: boolean; claimCount: number }>;
  generatedAt: number;
}

export function KycVerifyPage() {
  const { address: connected } = useAccount();
  const [input, setInput] = useState(connected ?? "");
  const [result, setResult] = useState<PassportView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (!isAddress(input)) {
      setError("Invalid address");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(apiUrl(`/v1/passport/${input}`));
      if (!res.ok) {
        const text = await res.text();
        throw new Error(res.status === 502 ? `Backend at ${API_BASE_URL} may be offline (502)` : `Request failed: ${res.status} ${res.statusText}`);
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
    <div className="py-12 px-4 animate-fade-in max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">KYC Verification</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Check a wallet's verification status across KYC, AML, accredited investor, and age-gate credentials.
      </p>

      <div className="flex gap-2 mb-6">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x... subject address"
          className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono"
        />
        <button
          onClick={verify}
          disabled={loading}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium text-sm transition-colors"
        >
          {loading ? "Loading..." : "Look Up"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700 dark:text-red-300 mb-2">{error}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            API endpoint: <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">{API_BASE_URL}</code>
          </p>
          <button
            onClick={verify}
            className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !result && (
        <div className="text-center py-8">
          <div className="animate-pulse flex justify-center gap-2 mb-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Looking up on-chain passport...</p>
        </div>
      )}

      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{result.address}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Service Status</p>
          <div className="flex flex-wrap gap-2">
            {ALL_SERVICE_KEYS.map((key) => {
              const svc = result.services?.[key] ?? { verified: false, claimCount: 0 };
              return (
                <div key={key} className="text-xs">
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{SERVICE_LABELS[key]}</p>
                  <ServiceBadge name={key} verified={svc.verified} claimCount={svc.claimCount} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

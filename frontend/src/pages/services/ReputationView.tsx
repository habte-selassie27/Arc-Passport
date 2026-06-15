import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { isAddress } from "viem";
import { ServiceBadge } from "../../components/passport/ServiceBadge";
import { SERVICE_LABELS, type ServiceKey } from "../../types/passport";
import { apiUrl, API_BASE_URL } from "../../config/api";

interface ReputationView {
  address:  string;
  services: Record<ServiceKey, { claimCount: number; verified: boolean }>;
}

export function ReputationViewPage() {
  const { address } = useParams<{ address: string }>();
  const [data, setData] = useState<ReputationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    if (!address || !isAddress(address)) {
      setError("Invalid address");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(apiUrl(`/v1/passport/${address}`))
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 502 ? "Backend offline (502)" : `Request failed: ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message ?? "Fetch failed");
        setData(json.data);
      })
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [address]);

  if (loading) {
    return (
      <div className="py-12 px-4 text-center">
        <div className="animate-pulse flex justify-center gap-2 mb-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading reputation data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 px-4 text-center max-w-md mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <p className="text-sm text-red-700 dark:text-red-300 mb-2">{error}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            API: <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">{API_BASE_URL}</code>
          </p>
          <button onClick={fetchData} className="text-xs text-red-600 dark:text-red-400 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="py-12 px-4 text-center text-gray-500">No data found.</div>;
  }

  const rep = data.services?.reputation;

  return (
    <div className="py-12 px-4 animate-fade-in max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Reputation & Trust</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-6">{data.address}</p>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{SERVICE_LABELS.reputation}</p>
          <ServiceBadge name="reputation" verified={rep?.verified} claimCount={rep?.claimCount} />
        </div>
        {rep?.verified ? (
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{rep.claimCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">on-chain reputation claims</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No reputation score issued</p>
        )}
      </div>
    </div>
  );
}

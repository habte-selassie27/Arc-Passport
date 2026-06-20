import { useEffect, useState } from "react";

interface EventAnalytics {
  lastMinute: number;
  lastHour: number;
  total: number;
}

interface AnalyticsData {
  events: Record<string, EventAnalytics>;
  generatedAt: number;
}

const SERVICE_NAMES = [
  "identity", "kyc", "credentials", "dao",
  "reputation", "employment", "education", "social", "custom",
] as const;

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001"}/v1/analytics`);
        const json = await res.json();
        if (json.success) setData(json.data);
        else setError("Failed to load analytics");
      } catch (err) {
        setError((err as Error).message);
      }
    };
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30_000);
    return () => clearInterval(interval);
  }, []);

  const claimIssued = data?.events?.ClaimIssued ?? { lastMinute: 0, lastHour: 0, total: 0 };
  const claimRevoked = data?.events?.ClaimRevoked ?? { lastMinute: 0, lastHour: 0, total: 0 };
  const schemasRegistered = data?.events?.SchemaRegistered ?? { lastMinute: 0, lastHour: 0, total: 0 };
  const roleGrants = data?.events?.RoleGranted ?? { lastMinute: 0, lastHour: 0, total: 0 };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Analytics</h3>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Claims Issued (total)" value={claimIssued.total} accent="blue" />
        <StatCard label="Claims Revoked (total)" value={claimRevoked.total} accent="red" />
        <StatCard label="Schemas Registered" value={schemasRegistered.total} accent="purple" />
        <StatCard label="Role Grants" value={roleGrants.total} accent="amber" />
      </div>

      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Real-time Activity</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Claims/min</span>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{claimIssued.lastMinute}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Revocations/min</span>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{claimRevoked.lastMinute}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Claims/hour</span>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{claimIssued.lastHour}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Schemas/hour</span>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{schemasRegistered.lastHour}</p>
          </div>
        </div>
      </div>

      {data?.generatedAt && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Last updated: {new Date(data.generatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-400",
    red: "text-red-600 dark:text-red-400",
    purple: "text-purple-600 dark:text-purple-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${colors[accent] ?? "text-gray-900 dark:text-white"}`}>{value}</p>
    </div>
  );
}

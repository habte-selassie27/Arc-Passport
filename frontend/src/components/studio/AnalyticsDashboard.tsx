import { useState } from "react";

export function AnalyticsDashboard() {
  const [services] = useState({
    identity:    { issued: 0, revoked: 0, pending: 0 },
    kyc:         { issued: 0, revoked: 0, pending: 0 },
    credentials: { issued: 0, revoked: 0, pending: 0 },
    dao:         { issued: 0, revoked: 0, pending: 0 },
    reputation:  { issued: 0, revoked: 0, pending: 0 },
    employment:  { issued: 0, revoked: 0, pending: 0 },
    education:   { issued: 0, revoked: 0, pending: 0 },
    social:      { issued: 0, revoked: 0, pending: 0 },
    custom:      { issued: 0, revoked: 0, pending: 0 },
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Analytics</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Per-service issuance volume, revocations, and pending claims.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2">Service</th>
              <th className="py-2 text-right">Issued</th>
              <th className="py-2 text-right">Revoked</th>
              <th className="py-2 text-right">Pending</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(services).map(([name, stats]) => (
              <tr key={name} className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="py-2 capitalize text-gray-900 dark:text-white">{name}</td>
                <td className="py-2 text-right text-gray-700 dark:text-gray-300">{stats.issued}</td>
                <td className="py-2 text-right text-red-600 dark:text-red-400">{stats.revoked}</td>
                <td className="py-2 text-right text-yellow-600 dark:text-yellow-400">{stats.pending}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

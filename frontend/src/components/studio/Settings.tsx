import { ALL_SERVICE_KEYS, SERVICE_LABELS, type ServiceKey } from "../../types/passport";

export function Settings() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Issuer Settings</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Per-service issuer wallet status. Configured via backend Circle wallets.
      </p>

      <div className="space-y-2">
        {ALL_SERVICE_KEYS.map((key: ServiceKey) => (
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
            <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              not configured
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

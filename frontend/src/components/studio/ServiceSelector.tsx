import { ALL_SERVICE_KEYS, type ServiceKey, SERVICE_LABELS } from "../../types/passport";

interface ServiceSelectorProps {
  value: ServiceKey | null;
  onChange: (key: ServiceKey) => void;
}

const SERVICE_COLORS: Record<ServiceKey, string> = {
  identity:    "border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200",
  kyc:         "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200",
  credentials: "border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200",
  dao:         "border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200",
  reputation:  "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200",
  employment:  "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200",
  education:   "border-pink-400 bg-pink-50 dark:bg-pink-900/20 text-pink-800 dark:text-pink-200",
  social:      "border-teal-400 bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200",
  custom:      "border-gray-400 bg-gray-50 dark:bg-gray-700/20 text-gray-800 dark:text-gray-200",
};

export function ServiceSelector({ value, onChange }: ServiceSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ALL_SERVICE_KEYS.map((key) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              active
                ? SERVICE_COLORS[key]
                : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400"
            }`}
          >
            {SERVICE_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}

import { useState } from "react";
import { SCHEMA_TEMPLATES, type SchemaTemplate } from "./SchemaTemplates";
import { ALL_SERVICE_KEYS, SERVICE_LABELS, type ServiceKey } from "../../types/passport";

export function TemplateSelector() {
  const [active, setActive] = useState<ServiceKey>("kyc");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Schema Templates</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Pre-built schema templates for each service vertical.
      </p>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {ALL_SERVICE_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              active === key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
            }`}
          >
            {SERVICE_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SCHEMA_TEMPLATES[active].map((t: SchemaTemplate) => (
          <div
            key={t.name}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t.description}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t.fields.length} field{t.fields.length === 1 ? "" : "s"} · v{t.version}
            </p>
          </div>
        ))}
        {SCHEMA_TEMPLATES[active].length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic col-span-2">
            No predefined templates — use the Schema Builder.
          </p>
        )}
      </div>
    </div>
  );
}

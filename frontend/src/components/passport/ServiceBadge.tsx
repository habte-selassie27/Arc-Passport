interface ServiceBadgeProps {
  name: string;
  status?: string;
  activeClaims?: number;
  verified?: boolean;
  claimCount?: number;
}

const SERVICE_COLORS: Record<string, string> = {
  identity:    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  kyc:         "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  credentials: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
  dao:         "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
  reputation:  "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
  employment:  "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
  education:   "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700",
  social:      "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700",
  custom:      "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
};

const DEFAULT_COLOR = "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";

export function ServiceBadge({
  name,
  status,
  activeClaims,
  verified,
  claimCount,
}: ServiceBadgeProps) {
  const colorClass = SERVICE_COLORS[name] ?? DEFAULT_COLOR;
  const isVerified = verified ?? (status === "ok" && (claimCount ?? activeClaims ?? 0) > 0);
  const count = claimCount ?? activeClaims ?? 0;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${colorClass} transition-colors`}
    >
      <span className={`w-2 h-2 rounded-full ${isVerified ? "bg-green-500" : "bg-gray-400"}`} />
      <span className="capitalize">{name}</span>
      {count > 0 && <span className="opacity-70">({count})</span>}
    </div>
  );
}

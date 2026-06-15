interface ClaimBadgeProps {
  claim: { claimId: string; schemaId: string; issuer: string; valid: boolean };
}

const SCHEMA_COLORS: Record<string, string> = {
  kyc: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  professional: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
  identity: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
};

const DEFAULT_VALID = "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
const DEFAULT_INVALID = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";

export function ClaimBadge({ claim }: ClaimBadgeProps) {
  const colorClass = claim.valid
    ? (SCHEMA_COLORS[claim.schemaId] ?? DEFAULT_VALID)
    : DEFAULT_INVALID;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border font-medium ${colorClass} transition-colors`} title={`Issuer: ${claim.issuer}`}>
      <span>{claim.valid ? "✓" : "✗"}</span>
      <span>{claim.schemaId.slice(0, 10)}...</span>
    </div>
  );
}

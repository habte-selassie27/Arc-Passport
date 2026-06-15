import { useSimulateContract } from "wagmi";
import { parseContractError } from "../../utils/parseContractError";
import type { Address } from "viem";

interface TransactionPreviewProps {
  enabled: boolean;
  address: Address | undefined;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  label: string;
}

export function TransactionPreview({ enabled, address, abi, functionName, args, label }: TransactionPreviewProps) {
  const { data, isLoading, isError, error } = useSimulateContract({
    address,
    abi,
    functionName,
    args,
    query: { enabled },
  });

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
        <p className="font-medium text-red-700 dark:text-red-300 mb-1">⚠ Transaction would fail:</p>
        <p className="text-red-600 dark:text-red-400">{parseContractError(error)}</p>
      </div>
    );
  }

  if (!data?.request) return null;

  return (
    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs">
      <div className="flex items-center gap-1 text-green-700 dark:text-green-300 mb-1">
        <span>✓</span>
        <span className="font-medium">{label} — simulation passed</span>
      </div>
      <p className="text-green-600 dark:text-green-400">
        {functionName}({args.map((a, i) => {
          const s = String(a);
          return s.length > 20 ? `${s.slice(0, 10)}...${s.slice(-6)}` : s;
        }).join(", ")})
      </p>
    </div>
  );
}

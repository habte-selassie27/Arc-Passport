import { useWaitForTransactionReceipt, useGasPrice } from "wagmi";

interface TxStatusProps {
  hash: `0x${string}` | undefined;
  onSuccess?: () => void;
}

export function TxStatus({ hash, onSuccess }: TxStatusProps) {
  const { isLoading, isSuccess, isError, data: receipt } = useWaitForTransactionReceipt({ hash });
  const { data: gasPrice } = useGasPrice({ query: { enabled: isSuccess && !!hash } });

  if (!hash) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
        <div className="animate-spin h-3 w-3 border-2 border-yellow-600 dark:border-yellow-400 border-t-transparent rounded-full" />
        Confirming transaction...
      </div>
    );
  }

  if (isSuccess) {
    if (onSuccess) onSuccess();
    const gasUsed = receipt?.gasUsed;
    const effectiveGasPrice = receipt?.effectiveGasPrice;
    const totalWei = gasUsed && effectiveGasPrice ? gasUsed * effectiveGasPrice : null;
    const usdcCost = totalWei ? Number(totalWei) / 1e18 : null;

    return (
      <div className="flex flex-col gap-1 text-green-600 dark:text-green-400 text-sm">
        <div className="flex items-center gap-1">
          <span>✓</span> Transaction confirmed
          {usdcCost !== null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              (Fee: ${usdcCost < 0.01 ? `<0.01` : usdcCost.toFixed(2)} USDC)
            </span>
          )}
        </div>
        <a
          href={`https://testnet.arcscan.app/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline font-mono truncate"
        >
          View on ArcScan ↗
        </a>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
        <span>✗</span> Transaction failed
      </div>
    );
  }

  return null;
}

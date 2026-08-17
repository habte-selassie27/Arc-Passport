import { useWaitForTransactionReceipt, useGasPrice } from "wagmi";
import { Spinner } from "../ui/Spinner";

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
      <div className="flex items-center gap-2 c-warn t-sm" role="status">
        <Spinner size={12} />
        Confirming transaction…
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
      <div className="flex flex-col gap-1 c-verified t-sm">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">✓</span> Transaction confirmed
          {usdcCost !== null && (
            <span className="t-xs c-subtle">
              (Fee: ${usdcCost < 0.01 ? "<0.01" : usdcCost.toFixed(2)} USDC)
            </span>
          )}
        </div>
        <a
          href={`https://testnet.arcscan.app/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="t-xs mono"
        >
          View on ArcScan ↗
        </a>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 c-danger t-sm" role="alert">
        <span aria-hidden="true">✗</span> Transaction failed
      </div>
    );
  }

  return null;
}

import { useGasPrice, useSimulateContract } from "wagmi";
import type { Address } from "viem";

interface GasEstimateProps {
  enabled: boolean;
  address: Address | undefined;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}

export function GasEstimate({ enabled, address, abi, functionName, args }: GasEstimateProps) {
  const { data: simData } = useSimulateContract({
    address,
    abi,
    functionName,
    args,
    query: { enabled },
  });

  const { data: gasPrice } = useGasPrice({ query: { enabled } });

  if (!enabled || !simData?.request?.gas || !gasPrice) return null;

  const totalWei = simData.request.gas * gasPrice;
  const usdcCost = Number(totalWei) / 1e18;

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.75 5a.75.75 0 00-.75.75v5.5a.75.75 0 001.5 0v-5.5A.75.75 0 009.75 5zm0 10.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
      Est. fee: ~${usdcCost < 0.01 ? "<0.01" : usdcCost.toFixed(2)} USDC
    </div>
  );
}

import { useEffect } from "react";
import { useSimulateContract, useGasPrice } from "wagmi";
import { parseContractError } from "../../utils/parseContractError";
import { SimulationBox } from "../ui/SimulationBox";
import type { Address } from "viem";

interface TransactionPreviewProps {
  enabled: boolean;
  address: Address | undefined;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  label: string;
  /** Called when simulation completes. The caller can use this to gate the write call. */
  onSimResult?: (result: { request: unknown | null; error: string | null }) => void;
}

function short(v: unknown): string {
  const s = String(v);
  return s.length > 20 ? `${s.slice(0, 10)}...${s.slice(-6)}` : s;
}

export function TransactionPreview({ enabled, address, abi, functionName, args, label, onSimResult }: TransactionPreviewProps) {
  const { data, isLoading, isError, error } = useSimulateContract({
    address,
    abi,
    functionName,
    args,
    query: { enabled },
  });

  const { data: gasPrice } = useGasPrice({ query: { enabled: enabled && !!data?.request } });

  // Notify parent of simulation result for write gating (§15.6.1)
  useEffect(() => {
    if (onSimResult && enabled && !isLoading) {
      onSimResult({
        request: data?.request ?? null,
        error: isError ? parseContractError(error) : null,
      });
    }
  }, [onSimResult, enabled, isLoading, data, isError, error]);

  if (!enabled) return null;

  if (isLoading) {
    return <SimulationBox state="loading" />;
  }

  if (isError) {
    return <SimulationBox state="failed" errorMessage={parseContractError(error)} />;
  }

  if (!data?.request) return null;

  const gasUnits = data.request.gas;
  const totalWei = gasUnits && gasPrice ? gasUnits * gasPrice : null;
  const usdcCost = totalWei ? Number(totalWei) / 1e18 : null;

  return (
    <SimulationBox
      state="passed"
      items={[
        { label: "Simulation passed" },
        {
          label: "Gas estimate:",
          value: `~${gasUnits ? Number(gasUnits).toLocaleString() : "—"} units` +
            (usdcCost !== null ? ` · ~$${usdcCost < 0.01 ? "<0.01" : usdcCost.toFixed(2)} USDC` : ""),
        },
        { label: `${label}:`, value: `${functionName}(${args.map(short).join(", ")})` },
      ]}
    />
  );
}

import { useState, useCallback, useRef } from "react";
import { useWriteContract } from "wagmi";
import { ADDRESSES } from "../../config/addresses";
import { ATTESTATION_REGISTRY_ABI } from "../../abis/AttestationRegistry";
import { TxStatus } from "../shared/TxStatus";
import { TransactionPreview } from "../shared/TransactionPreview";
import { GasEstimate } from "../shared/GasEstimate";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";

export function RevokeForm() {
  const [claimId, setClaimId] = useState("");

  const revokeArgs: readonly unknown[] = [claimId as `0x${string}`] as const;
  const simEnabled = !!claimId && claimId.startsWith("0x") && !!ADDRESSES.attestationRegistry;

  const simRequestRef = useRef<unknown | null>(null);

  const handleSimResult = useCallback((result: { request: unknown | null; error: string | null }) => {
    simRequestRef.current = result.request;
  }, []);

  const { writeContract, data: hash, isPending, error } = useWriteContract({
    mutation: {
      onError: (err) => toast("error", parseContractError(err)),
    },
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!claimId.startsWith("0x")) {
      toast("error", "claimId must be a hex string starting with 0x");
      return;
    }
    if (!simRequestRef.current) {
      toast("error", "Transaction simulation did not succeed. Check the claim ID.");
      return;
    }
    writeContract(simRequestRef.current as Parameters<typeof writeContract>[0]);
  }, [writeContract, claimId]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Revoke Claim</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Claim ID</label>
        <input
          type="text"
          value={claimId}
          onChange={(e) => setClaimId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-shadow"
          placeholder="0x..."
          required
        />
      </div>

      <TransactionPreview
        enabled={simEnabled}
        address={ADDRESSES.attestationRegistry}
        abi={ATTESTATION_REGISTRY_ABI}
        functionName="revoke"
        args={revokeArgs}
        label="Revocation"
        onSimResult={handleSimResult}
      />

      <GasEstimate
        enabled={simEnabled}
        address={ADDRESSES.attestationRegistry}
        abi={ATTESTATION_REGISTRY_ABI}
        functionName="revoke"
        args={revokeArgs}
      />

      <button
        type="submit"
        disabled={isPending || !simEnabled}
        className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-all active:scale-[0.98] font-medium"
      >
        {isPending ? "Revoking..." : "Revoke Claim"}
      </button>

      <TxStatus hash={hash} />
      {error && <p className="text-red-600 dark:text-red-400 text-sm text-center">{parseContractError(error)}</p>}
    </form>
  );
}

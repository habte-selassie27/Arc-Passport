import { useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ADDRESSES } from "../../config/addresses";
import { ATTESTATION_REGISTRY_ABI } from "../../abis/AttestationRegistry";
import { TxStatus } from "../shared/TxStatus";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";
import { AddressDisplay } from "../shared/AddressDisplay";

export function RevokeDashboard() {
  const [search, setSearch] = useState("");
  const [lookupKey, setLookupKey] = useState<string | null>(null);

  const isClaimId = search.startsWith("0x") && search.length === 66;

  const { data: claim, isLoading: lookupLoading, isError: lookupError } = useReadContract({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_REGISTRY_ABI,
    functionName: "getClaim",
    args: [lookupKey as `0x${string}`],
    query: { enabled: !!lookupKey && isClaimId && !!ADDRESSES.attestationRegistry },
  });

  const { writeContract: doRevoke, data: revokeHash, isPending: revokePending, error: revokeError } = useWriteContract({
    mutation: {
      onError: (err) => toast("error", parseContractError(err)),
      onSuccess: () => toast("success", "Claim revoked"),
    },
  });

  const { isLoading: revokeConfirming } = useWaitForTransactionReceipt({ hash: revokeHash });

  const handleLookup = () => {
    const trimmed = search.trim();
    if (!trimmed.startsWith("0x")) {
      toast("error", "Enter a valid 0x claim ID");
      return;
    }
    setLookupKey(trimmed);
  };

  const handleRevoke = () => {
    if (!lookupKey) return;
    doRevoke({
      address: ADDRESSES.attestationRegistry!,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "revoke",
      args: [lookupKey as `0x${string}`],
    });
  };

  const claimData = claim as
    | [string, string, string, string, string, bigint, bigint, boolean]
    | undefined;

  const revoked = claimData?.[7] ?? false;
  const pending = revokePending || revokeConfirming;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Revoke Manager</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Enter a claim ID to look up its details and revoke it. You must hold REVOKER_ROLE on the AttestationRegistry.
      </p>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="0x... claimId"
          className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono"
          onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
        />
        <button
          onClick={handleLookup}
          disabled={lookupLoading || !search.trim()}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium text-sm transition-colors"
        >
          {lookupLoading ? "..." : "Look up"}
        </button>
      </div>

      {lookupError && (
        <div className="text-xs text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/20 rounded">
          Claim not found or chain error
        </div>
      )}

      {claimData && (
        <div className="rounded border border-gray-200 dark:border-gray-700 p-3 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-900 dark:text-white">Claim Details</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                revoked
                  ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                  : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
              }`}
            >
              {revoked ? "Revoked" : "Active"}
            </span>
          </div>
          <div className="space-y-1 text-gray-600 dark:text-gray-400">
            <p><span className="text-gray-500">Subject:</span> <AddressDisplay address={claimData[1] as `0x${string}`} /></p>
            <p><span className="text-gray-500">Schema ID:</span> <span className="font-mono">{(claimData[2] as string).slice(0, 16)}...</span></p>
            <p><span className="text-gray-500">Issuer:</span> <AddressDisplay address={claimData[3] as `0x${string}`} /></p>
            <p><span className="text-gray-500">Issued:</span> {new Date(Number(claimData[5]) * 1000).toLocaleString()}</p>
            {(claimData[6] as bigint) > 0n && (
              <p><span className="text-gray-500">Expires:</span> {new Date(Number(claimData[6]) * 1000).toLocaleString()}</p>
            )}
          </div>

          {!revoked && (
            <button
              onClick={handleRevoke}
              disabled={pending}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-all active:scale-[0.98] font-medium text-sm"
            >
              {pending ? "Revoking..." : "Revoke This Claim"}
            </button>
          )}
        </div>
      )}

      {!lookupKey && !claimData && (
        <div className="text-xs text-gray-500 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-900/50 rounded">
          Enter a claim ID above and click "Look up" to fetch claim details.
        </div>
      )}

      <TxStatus hash={revokeHash} />
      {revokeError && <p className="text-red-600 dark:text-red-400 text-xs text-center">{parseContractError(revokeError)}</p>}
    </div>
  );
}

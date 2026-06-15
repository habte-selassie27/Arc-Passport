import { useState, useCallback, useRef } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ADDRESSES } from "../../config/addresses";
import { MEMO_ABI } from "../../abis/Memo";
import { TxStatus } from "../shared/TxStatus";
import { TransactionPreview } from "../shared/TransactionPreview";
import { GasEstimate } from "../shared/GasEstimate";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";
import { toHex } from "viem";

const ATTESTATION_REGISTRY_ABI = [
  {
    type: "function",
    name: "attest",
    inputs: [
      { name: "subject", type: "address" },
      { name: "schemaId", type: "bytes32" },
      { name: "dataCommitment", type: "bytes32" },
      { name: "expiresAt", type: "uint256" },
    ],
    outputs: [{ name: "claimId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

export function AttestForm() {
  const [subject, setSubject] = useState("");
  const [schemaId, setSchemaId] = useState("");
  const [data, setData] = useState("");
  const [expiresAt, setExpiresAt] = useState("0");
  const [complianceRef, setComplianceRef] = useState("");

  const subjectAddr = subject as `0x${string}`;
  const schemaBytes = schemaId as `0x${string}`;
  const commitment = (data || "0x0000000000000000000000000000000000000000000000000000000000000001") as `0x${string}`;
  const expiry = BigInt(expiresAt);
  const attestArgs = [subjectAddr, schemaBytes, commitment, expiry] as const;
  const simEnabled = !!subject && !!schemaId && !!ADDRESSES.attestationRegistry;

  // Store the simulation request for write gating (§15.6.1)
  const simRequestRef = useRef<unknown | null>(null);
  const simErrorRef = useRef<string | null>(null);

  const handleSimResult = useCallback((result: { request: unknown | null; error: string | null }) => {
    simRequestRef.current = result.request;
    simErrorRef.current = result.error;
  }, []);

  const { writeContract: doAttest, data: attestHash, isPending: attestPending, error: attestError } = useWriteContract({
    mutation: {
      onError: (err) => toast("error", parseContractError(err)),
      onSuccess: () => {
        if (complianceRef) {
          toast("info", "Recording compliance memo...");
        }
      },
    },
  });

  const { writeContract: doMemo, data: memoHash, isPending: memoPending } = useWriteContract({
    mutation: {
      onError: (err) => toast("error", `Memo failed: ${parseContractError(err)}`),
      onSuccess: () => toast("success", "Compliance memo recorded"),
    },
  });

  const { isSuccess: attestConfirmed } = useWaitForTransactionReceipt({ hash: attestHash });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!ADDRESSES.attestationRegistry) {
      toast("error", "AttestationRegistry not configured");
      return;
    }
    // §15.6.1: Only proceed if simulation succeeded and produced a request
    if (!simRequestRef.current) {
      toast("error", "Transaction simulation did not succeed. Check parameters.");
      return;
    }
    doAttest(simRequestRef.current as Parameters<typeof doAttest>[0]);
  }, [doAttest, subject, schemaId, data, expiresAt]);

  const handleRecordMemo = useCallback(() => {
    if (!complianceRef || !ADDRESSES.memoContract || !ADDRESSES.usdcErc20) return;
    doMemo({
      address: ADDRESSES.memoContract,
      abi: MEMO_ABI,
      functionName: "sendWithMemo",
      args: [subject as `0x${string}`, 1n, toHex(complianceRef)],
    });
  }, [doMemo, complianceRef, subject]);

  const pending = attestPending || memoPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject Address</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
          placeholder="0x..."
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schema ID</label>
        <input
          type="text"
          value={schemaId}
          onChange={(e) => setSchemaId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
          placeholder="0x..."
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Commitment (bytes32)</label>
        <input
          type="text"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
          placeholder="0x... or leave empty for default"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires At (timestamp, 0 = never)</label>
        <input
          type="number"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
          min="0"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Compliance Reference <span className="text-gray-400 font-normal">(optional — recorded via Memo contract)</span>
        </label>
        <input
          type="text"
          value={complianceRef}
          onChange={(e) => setComplianceRef(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow text-sm"
          placeholder="e.g. KYC-REF-2026-00142"
        />
      </div>

      <TransactionPreview
        enabled={simEnabled}
        address={ADDRESSES.attestationRegistry}
        abi={ATTESTATION_REGISTRY_ABI}
        functionName="attest"
        args={attestArgs}
        label="Attestation"
        onSimResult={handleSimResult}
      />

      <GasEstimate
        enabled={simEnabled}
        address={ADDRESSES.attestationRegistry}
        abi={ATTESTATION_REGISTRY_ABI}
        functionName="attest"
        args={attestArgs}
      />

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 text-xs text-yellow-800 dark:text-yellow-300">
        ArcPass never asks you to approve token spending. If you see a token approval request from this site, reject it immediately.
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !simEnabled}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-[0.98] font-medium"
        >
          {attestPending ? "Issuing..." : "Issue Attestation"}
        </button>
        {attestConfirmed && complianceRef && (
          <button
            type="button"
            onClick={handleRecordMemo}
            disabled={memoPending}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-all active:scale-[0.98] font-medium text-sm"
          >
            {memoPending ? "Recording..." : "Record Memo"}
          </button>
        )}
      </div>

      {attestError && <p className="text-red-600 dark:text-red-400 text-sm text-center">{parseContractError(attestError)}</p>}
      <TxStatus hash={attestHash} />
      <TxStatus hash={memoHash} />
    </form>
  );
}

import { useState, useCallback, useRef } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ADDRESSES } from "../../config/addresses";
import { MEMO_ABI } from "../../abis/Memo";
import { TxStatus } from "../shared/TxStatus";
import { TransactionPreview } from "../shared/TransactionPreview";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
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

  const simRequestRef = useRef<unknown | null>(null);

  const handleSimResult = useCallback((result: { request: unknown | null; error: string | null }) => {
    simRequestRef.current = result.request;
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
    // Only proceed if simulation succeeded and produced a request (§15.6.1)
    if (!simRequestRef.current) {
      toast("error", "Transaction simulation did not succeed. Check parameters.");
      return;
    }
    doAttest(simRequestRef.current as Parameters<typeof doAttest>[0]);
  }, [doAttest]);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Subject Address" htmlFor="attest-subject" helper="The wallet receiving the credential.">
        <Input
          id="attest-subject"
          mono
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="0x..."
          required
        />
      </Field>

      <Field label="Schema ID" htmlFor="attest-schema">
        <Input
          id="attest-schema"
          mono
          type="text"
          value={schemaId}
          onChange={(e) => setSchemaId(e.target.value)}
          placeholder="0x..."
          required
        />
      </Field>

      <Field label="Data Commitment (bytes32)" htmlFor="attest-data" helper="Leave empty to use the default commitment.">
        <Input
          id="attest-data"
          mono
          type="text"
          value={data}
          onChange={(e) => setData(e.target.value)}
          placeholder="0x... or leave empty for default"
        />
      </Field>

      <Field label="Expires At (unix timestamp, 0 = never)" htmlFor="attest-expiry">
        <Input
          id="attest-expiry"
          mono
          type="number"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          min="0"
        />
      </Field>

      <Field label="Compliance Reference (optional)" htmlFor="attest-memo" helper="Recorded via the Memo contract after issuance.">
        <Input
          id="attest-memo"
          type="text"
          value={complianceRef}
          onChange={(e) => setComplianceRef(e.target.value)}
          placeholder="e.g. KYC-REF-2026-00142"
        />
      </Field>

      {/* Commitment preview — shows the data commitment that will be stored on-chain */}
      {simEnabled && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <p className="eyebrow" style={{ marginBottom: "var(--space-1)" }}>Commitment preview</p>
          <div className="schema-compute">
            <div className="schema-compute__step">
              <span className="merkle-leaf" aria-hidden="true" />
              <span className="schema-compute__arrow">→</span>
              <span>attest(subject, schemaId, <span className="schema-compute__value">dataCommitment</span>, expiresAt)</span>
            </div>
            <div className="schema-compute__step" style={{ paddingLeft: "18px" }}>
              <span className="t-xs c-subtle">on-chain: keccak256(payload) stored as bytes32 — raw data never touches the chain</span>
            </div>
          </div>
        </div>
      )}

      <TransactionPreview
        enabled={simEnabled}
        address={ADDRESSES.attestationRegistry}
        abi={ATTESTATION_REGISTRY_ABI}
        functionName="attest"
        args={attestArgs}
        label="Attestation"
        onSimResult={handleSimResult}
      />

      <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
        <Button type="submit" block disabled={pending || !simEnabled} loading={attestPending}>
          Issue Attestation
        </Button>
        {attestConfirmed && complianceRef && (
          <Button type="button" variant="ghost" onClick={handleRecordMemo} loading={memoPending} style={{ flex: 1 }}>
            Record Memo
          </Button>
        )}
      </div>

      {attestError && <p className="c-danger t-sm text-center">{parseContractError(attestError)}</p>}
      <TxStatus hash={attestHash} />
      <TxStatus hash={memoHash} />
    </form>
  );
}

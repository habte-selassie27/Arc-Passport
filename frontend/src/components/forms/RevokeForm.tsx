import { useState, useCallback, useRef } from "react";
import { useWriteContract } from "wagmi";
import { ADDRESSES } from "../../config/addresses";
import { ATTESTATION_REGISTRY_ABI } from "../../abis/AttestationRegistry";
import { TxStatus } from "../shared/TxStatus";
import { TransactionPreview } from "../shared/TransactionPreview";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Claim ID" htmlFor="revoke-claim" helper="The on-chain claim ID (0x…). Only the issuer who created this claim can revoke it.">
        <Input
          id="revoke-claim"
          mono
          type="text"
          value={claimId}
          onChange={(e) => setClaimId(e.target.value)}
          placeholder="0x..."
          required
        />
      </Field>

      <TransactionPreview
        enabled={simEnabled}
        address={ADDRESSES.attestationRegistry}
        abi={ATTESTATION_REGISTRY_ABI}
        functionName="revoke"
        args={revokeArgs}
        label="Revocation"
        onSimResult={handleSimResult}
      />

      <Button type="submit" block variant="danger" disabled={isPending || !simEnabled} loading={isPending}>
        Revoke Claim
      </Button>

      <TxStatus hash={hash} />
      {error && <p className="c-danger t-sm text-center">{parseContractError(error)}</p>}
    </form>
  );
}

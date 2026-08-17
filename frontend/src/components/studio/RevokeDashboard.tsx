import { useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ADDRESSES } from "../../config/addresses";
import { ATTESTATION_REGISTRY_ABI } from "../../abis/AttestationRegistry";
import { TxStatus } from "../shared/TxStatus";
import { parseContractError } from "../../utils/parseContractError";
import { toast } from "../shared/Toast";
import { AddressDisplay } from "../ui/AddressDisplay";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { StatusChip } from "../ui/StatusChip";
import { schemaNameForId } from "../../utils/schemaNames";

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
    <Card>
      <h3 className="display--medium t-lg" style={{ marginBottom: "var(--space-2)" }}>Revoke Manager</h3>
      <p className="t-sm c-muted" style={{ marginBottom: "var(--space-4)" }}>
        Enter a claim ID to look up its details and revoke it. You must hold REVOKER_ROLE on the AttestationRegistry.
      </p>

      <div className="flex gap-2">
        <Input
          mono
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="0x... claimId"
          onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
          style={{ flex: 1 }}
        />
        <Button variant="primary" onClick={handleLookup} disabled={lookupLoading || !search.trim()} loading={lookupLoading}>
          Look up
        </Button>
      </div>

      {lookupError && (
        <div className="sim-box--failed sim-box" style={{ marginTop: "var(--space-4)" }} role="alert">
          <p className="sim-box__row"><span className="sim-box__fail" aria-hidden="true">✗</span> Claim not found or chain error</p>
        </div>
      )}

      {claimData && (
        <Card verified={!revoked} revoked={revoked} style={{ marginTop: "var(--space-4)", padding: "var(--space-5)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-3)" }}>
            <p className="card__title">Claim details</p>
            <StatusChip status={revoked ? "REVOKED" : "VALID"} />
          </div>

          <div className="space-y-0">
            <div className="data-row">
              <span className="data-row__label">Subject</span>
              <span className="data-row__value"><AddressDisplay address={claimData[1] as `0x${string}`} /></span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Schema</span>
              <span className="data-row__value mono t-xs">{schemaNameForId(claimData[2] as string)}</span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Issuer</span>
              <span className="data-row__value"><AddressDisplay address={claimData[3] as `0x${string}`} /></span>
            </div>
            <div className="data-row">
              <span className="data-row__label">Issued</span>
              <span className="data-row__value">{new Date(Number(claimData[5]) * 1000).toLocaleString()}</span>
            </div>
            {(claimData[6] as bigint) > 0n && (
              <div className="data-row">
                <span className="data-row__label">Expires</span>
                <span className="data-row__value">{new Date(Number(claimData[6]) * 1000).toLocaleString()}</span>
              </div>
            )}
          </div>

          {!revoked && (
            <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
              <Button variant="danger" block loading={pending} disabled={pending} onClick={handleRevoke}>
                Revoke this credential
              </Button>
            </div>
          )}
        </Card>
      )}

      {!lookupKey && !claimData && (
        <div className="t-xs c-subtle" style={{ marginTop: "var(--space-4)", background: "var(--color-surface-1)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)" }}>
          Enter a claim ID above and click "Look up" to fetch claim details.
        </div>
      )}

      <TxStatus hash={revokeHash} />
      {revokeError && <p className="c-danger t-xs text-center" style={{ marginTop: "var(--space-2)" }}>{parseContractError(revokeError)}</p>}
    </Card>
  );
}

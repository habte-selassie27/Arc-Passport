import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { useIssuerCheck } from "../hooks/useIssuerCheck";
import { AttestForm } from "../components/forms/AttestForm";
import { RevokeForm } from "../components/forms/RevokeForm";
import { CredentialRequestList } from "../components/forms/CredentialRequestList";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Callout } from "../components/ui/Callout";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { AddressDisplay } from "../components/ui/AddressDisplay";

export function IssuerPage() {
  const { isConnected, address } = useWallet();
  const { isIssuer, isLoading, error, check } = useIssuerCheck(address);

  useEffect(() => {
    if (address) void check();
  }, [address, check]);

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Dashboard"
          description="Issue attestations, revoke claims, and review credential requests. Requires ISSUER_ROLE on the AttestationRegistry."
        />
        <EmptyState
          title="Connect your wallet"
          body="Connect a wallet to check whether it holds issuer permissions on-chain."
        />
      </div>
    );
  }

  // State 1 — awaiting signature
  if (isLoading) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Issuer access"
          title="Verifying issuer permissions…"
          description="Check your wallet for a signature request. This confirms you hold ISSUER_ROLE on-chain."
        />
        <Card style={{ textAlign: "center" }}>
          <Spinner size={20} style={{ margin: "0 auto var(--space-4)", display: "block" }} aria-hidden="true" />
          <Button variant="ghost" disabled loading>
            Waiting for wallet…
          </Button>
        </Card>
      </div>
    );
  }

  if (error && isIssuer === null) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Dashboard"
          description="Issue attestations, revoke claims, and review credential requests."
        />
        <ErrorState
          title="Verification failed"
          body={<p className="t-xs c-subtle">{error}</p>}
          onRetry={() => void check()}
        />
      </div>
    );
  }

  // State 2 — not an issuer
  if (isIssuer === false) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Issuer access"
          title="Issuer Dashboard"
          description="Issue attestations, revoke claims, and review credential requests."
        />
        <Card revoked role="alert">
          <p className="error-state__title">
            <span aria-hidden="true">✗</span> Issuer role not found
          </p>
          <div style={{ marginTop: "var(--space-3)" }}>
            <div className="data-row">
              <span className="data-row__label">Connected wallet</span>
              <span className="data-row__value">
                {address && <AddressDisplay address={address} />}
              </span>
            </div>
          </div>
          <p className="card__desc" style={{ marginTop: "var(--space-3)" }}>
            This address does not hold ISSUER_ROLE on the AttestationRegistry contract. If you
            should have issuer access, contact the contract admin to grant your wallet the role.
          </p>
          <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)" }}>
            <Link to="/">
              <Button variant="ghost" size="sm">← Back to home</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // State 3 — authorized issuer
  return (
    <div className="animate-page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Issuer dashboard"
        title="Issue & Manage Credentials"
        description={`Connected issuer: ${address?.slice(0, 6)}...${address?.slice(-4) ?? ""}`}
        align="left"
        actions={
          <Link to="/studio">
            <Button variant="primary" size="sm">Open Issuer Studio →</Button>
          </Link>
        }
      />

      <div className="section">
        <Callout type="warn">
          <strong>ArcPass never asks you to approve token spending.</strong> Attestations are
          cryptographic commitments — not token transfers. If your wallet shows a token approval
          request (USDC <code className="mono t-xs">approve</code> or{" "}
          <code className="mono t-xs">setApprovalForAll</code>) on this site, reject it immediately
          and report it.
        </Callout>
      </div>

      <div className="section">
        <section aria-label="Issue attestation">
          <p className="eyebrow" style={{ marginBottom: "var(--space-4)" }}>
            Issue attestation
          </p>
          <AttestForm />
        </section>
      </div>

      <div className="section">
        <section aria-label="Revoke claim">
          <p className="eyebrow" style={{ marginBottom: "var(--space-4)" }}>
            Revoke claim
          </p>
          <RevokeForm />
        </section>
      </div>

      <div className="section">
        <section aria-label="Credential requests">
          <p className="eyebrow" style={{ marginBottom: "var(--space-4)" }}>
            Credential requests
          </p>
          <CredentialRequestList address={address as `0x${string}`} />
        </section>
      </div>
    </div>
  );
}

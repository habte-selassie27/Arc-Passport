import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePassport } from "../hooks/usePassport";
import { PassportCard } from "../components/passport/PassportCard";
import { CardSkeleton } from "../components/ui/Skeleton";
import { PassportErrorBoundary } from "../components/shared/PassportErrorBoundary";
import { NotificationsCard } from "../components/shared/NotificationsCard";
import { RequestCredentialForm } from "../components/forms/RequestCredentialForm";
import { useWallet } from "../contexts/WalletContext";
import { API_BASE_URL } from "../config/api";
import { PageHeader } from "../components/ui/PageHeader";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export function PassportPage() {
  const { address: paramAddress } = useParams<{ address: string }>();
  const { address: connectedAddress } = useWallet();
  const navigate = useNavigate();
  const targetAddress = (paramAddress || connectedAddress) as `0x${string}` | undefined;
  const { data: passport, isLoading, error, refetch } = usePassport(targetAddress);

  if (!targetAddress) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Public passport"
          title="View a Passport"
          description="Enter any Arc wallet address to view its public passport — credentials, issuers, and verification status. No wallet required."
        />
        <AddressEntry onNavigate={(addr) => navigate(`/passport/${addr}`)} />
      </div>
    );
  }

  return (
    <div className="animate-page">
      <PageHeader
        eyebrow="Public passport"
        title={`${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`}
        description="Shareable public passport. Anyone can inspect credentials and verify them on-chain."
        align="left"
      />

      <PassportErrorBoundary>
        {/* Slim, non-blocking backend-offline banner — never dominates the page */}
        {error && (
          <ErrorBanner onRetry={() => void refetch()}>
            Passport data unavailable — backend offline.{" "}
            <span className="c-subtle">({API_BASE_URL})</span> On-chain reads still work.
          </ErrorBanner>
        )}

        {isLoading && <CardSkeleton />}

        {!isLoading && !error && passport && <PassportCard passport={passport} />}

        {!isLoading && !error && !passport && (
          <Card>
            <EmptyState
              title="No passport data"
              body={`No indexed passport found for this address yet. Try again shortly, or verify credentials directly on-chain.`}
            />
          </Card>
        )}

        {/* Own-passport extras: notifications + credential requests (wallet required). */}
        {connectedAddress &&
          targetAddress &&
          connectedAddress.toLowerCase() === targetAddress.toLowerCase() && (
            <div className="section" style={{ marginTop: "var(--space-12)" }}>
              <NotificationsCard address={connectedAddress as `0x${string}`} />
              <div style={{ marginTop: "var(--space-6)" }}>
                <RequestCredentialForm address={connectedAddress as `0x${string}`} />
              </div>
            </div>
          )}
      </PassportErrorBoundary>
    </div>
  );
}

function AddressEntry({ onNavigate }: { onNavigate: (address: string) => void }) {
  const [value, setValue] = useState("");
  const valid = value.startsWith("0x");

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onNavigate(value);
      }}
    >
      <Input
        mono
        type="text"
        placeholder="0x... enter an address"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Wallet address"
      />
      <Button type="submit" disabled={!valid}>
        View
      </Button>
    </form>
  );
}

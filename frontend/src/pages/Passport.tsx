import { useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSignMessage } from "wagmi";
import { usePassport } from "../hooks/usePassport";
import { CardSkeleton } from "../components/ui/Skeleton";
import { PassportErrorBoundary } from "../components/shared/PassportErrorBoundary";
import { useWallet } from "../contexts/WalletContext";
import { API_BASE_URL } from "../config/api";
import { PageHeader } from "../components/ui/PageHeader";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useFieldProof, type ClaimFieldClassification } from "../hooks/useFieldProof";
import { PassportTabNav, OverviewPanel, CredentialsPanel, ActivityPanel, SharePanel } from "../components/passport/PassportTabs";

type TabKey = "overview" | "credentials" | "activity" | "share";

export function PassportPage() {
  const { address: paramAddress } = useParams<{ address: string }>();
  const { address: connectedAddress } = useWallet();
  const { signMessageAsync } = useSignMessage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetAddress = (paramAddress || connectedAddress) as `0x${string}` | undefined;
  const { data: passport, isLoading, error, refetch } = usePassport(targetAddress);

  const initialTab = (searchParams.get("tab") as TabKey) || "overview";
  const [activeTab, setActiveTab] = useState<TabKey>(
    ["overview", "credentials", "activity", "share"].includes(initialTab) ? initialTab : "overview"
  );

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "overview") next.delete("tab");
      else next.set("tab", tab);
      return next;
    }, { replace: true });
  };

  // Selective disclosure state (used in Credentials tab for owner)
  const [claimFields, setClaimFields] = useState<Record<string, ClaimFieldClassification[]>>({});
  const { fetchFields, fetchProof, loading: proofLoading } = useFieldProof();
  const [proofResult, setProofResult] = useState<import("../hooks/useFieldProof").FieldProof | null>(null);

  const handleRequestFields = useCallback(
    async (claimId: string) => {
      if (!connectedAddress) return;
      const fields = await fetchFields(claimId, connectedAddress, signMessageAsync);
      if (fields.length > 0) {
        setClaimFields((prev) => ({ ...prev, [claimId]: fields }));
      }
    },
    [connectedAddress, signMessageAsync, fetchFields]
  );

  const handleRequestProof = useCallback(
    async (claimId: string, fieldName: string) => {
      if (!connectedAddress) return;
      if (!claimFields[claimId]) {
        await handleRequestFields(claimId);
      }
      const proof = await fetchProof(claimId, fieldName, connectedAddress, signMessageAsync);
      setProofResult(proof);
    },
    [connectedAddress, signMessageAsync, fetchProof, claimFields, handleRequestFields]
  );

  const isOwner =
    connectedAddress &&
    targetAddress &&
    connectedAddress.toLowerCase() === targetAddress.toLowerCase();

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
        {error && (
          <ErrorBanner onRetry={() => void refetch()}>
            Passport data unavailable — backend offline.{" "}
            <span className="c-subtle">({API_BASE_URL})</span> On-chain reads still work.
          </ErrorBanner>
        )}

        {isLoading && <CardSkeleton />}

        {!isLoading && !error && !passport && (
          <Card>
            <EmptyState
              title="No passport data"
              body="No indexed passport found for this address yet. Try again shortly, or verify credentials directly on-chain."
            />
          </Card>
        )}

        {!isLoading && passport && (
          <>
            <PassportTabNav active={activeTab} onChange={handleTabChange} />
            {activeTab === "overview" && <OverviewPanel passport={passport} />}
            {activeTab === "credentials" && (
              <CredentialsPanel
                passport={passport}
                claimFields={isOwner ? claimFields : undefined}
                onRequestProof={isOwner ? handleRequestProof : undefined}
                proofResult={isOwner ? proofResult : undefined}
                proofLoading={isOwner ? proofLoading : undefined}
                isOwner={!!isOwner}
              />
            )}
            {activeTab === "activity" && <ActivityPanel address={targetAddress} passport={passport} />}
            {activeTab === "share" && <SharePanel passport={passport} />}
          </>
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

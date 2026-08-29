/**
 * RegisterHistoryPage — On-chain identity registration history.
 * Shows every mint of the IdentityRegistry NFT for an address, with tx
 * links, timestamps, current ownership status and passport links.
 */

import { Link, useParams } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { useIdentityHistory } from "../hooks/useIdentity";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { AddressDisplay } from "../components/ui/AddressDisplay";
import { Button } from "../components/ui/Button";

const ARCSCAN_TOKEN = "https://testnet.arcscan.app/token";
const ARCSCAN_TX = "https://testnet.arcscan.app/tx";
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RegistrationCard({
  tokenId,
  txHash,
  blockNumber,
  timestamp,
  status,
  address,
  metadataUri,
}: {
  tokenId: number;
  txHash?: string;
  blockNumber?: number;
  timestamp?: number;
  status?: string;
  address: string;
  metadataUri?: string | null;
}) {
  const isActive = !status || status === "active";
  const headline = status === "transferred" ? "Transferred away" : status === "burned" ? "Burned" : "Identity registered";

  return (
    <Card verified={isActive}>
      <div style={{ textAlign: "center", padding: "var(--space-4)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>{isActive ? "✓" : status === "burned" ? "✕" : "→"}</div>
        <p
          className="t-lg"
          style={{
            fontWeight: 600,
            marginBottom: "var(--space-1)",
            color: isActive ? "var(--color-verified)" : "var(--color-subtle)",
          }}
        >
          {headline}
        </p>
        <p className="t-sm c-subtle">Token #{tokenId}</p>

        <div style={{ display: "flex", justifyContent: "center", margin: "var(--space-3) 0 var(--space-1)" }}>
          <AddressDisplay address={address} />
        </div>

        {(timestamp !== undefined || blockNumber !== undefined) && (
          <p className="t-xs c-subtle" style={{ marginBottom: "var(--space-2)" }}>
            Registered {formatTimestamp(timestamp!)}
            {blockNumber ? (
              <>
                {" · "}
                <span className="mono">block {blockNumber}</span>
              </>
            ) : null}
          </p>
        )}

        {metadataUri && (
          <p className="t-xs mono c-subtle" style={{ wordBreak: "break-all", marginBottom: "var(--space-2)" }}>
            metadata: {metadataUri}
          </p>
        )}

        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", flexWrap: "wrap", marginTop: "var(--space-2)" }}>
          {txHash && (
            <a href={`${ARCSCAN_TX}/${txHash}`} target="_blank" rel="noopener noreferrer" className="t-xs mono" style={{ color: "var(--color-arc-primary)" }}>
              View transaction ↗
            </a>
          )}
          <a href={`${ARCSCAN_TOKEN}/${IDENTITY_REGISTRY}/${tokenId}`} target="_blank" rel="noopener noreferrer" className="t-xs mono" style={{ color: "var(--color-arc-primary)" }}>
            View token ↗
          </a>
          {isActive && (
            <Link to={`/passport/${address}`} className="t-xs mono" style={{ color: "var(--color-arc-primary)" }}>
              View passport →
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

export function RegisterHistoryPage() {
  const { address: addressParam } = useParams<{ address?: string }>();
  const { address: walletAddress } = useWallet();
  const address = (addressParam ?? walletAddress) as `0x${string}` | undefined;

  const { data, isLoading, isError, error, refetch } = useIdentityHistory(address);

  if (!address) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Registration History"
          title="Register History"
          description="On-chain identity registrations for a wallet."
        />
        <EmptyState
          title="Connect your wallet"
          body="Connect a wallet or open /register-history/:address to inspect any registration."
          action={
            <Link to="/register">
              <Button variant="ghost" size="sm">Go to Register →</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Registration History"
        title="Register History"
        description="Every identity this wallet has registered on-chain."
      />

      {isLoading && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifyContent: "center", padding: "var(--space-6)" }}>
            <Spinner size={16} />
            <span className="t-sm c-subtle">Scanning on-chain registrations…</span>
          </div>
        </Card>
      )}

      {isError && (
        <ErrorState
          title="Failed to load history"
          body={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      )}

      {data && (
        <div className="grid gap-4">
          {data.registrations.length === 0 && !data.identity && !data.partialScan && (
            <EmptyState
              title="No registration found"
              body={`No identity registered for ${address}.`}
              action={
                <Link to="/register">
                  <Button size="sm">Register Identity</Button>
                </Link>
              }
            />
          )}

          {data.registrations.length === 0 && !data.identity && data.partialScan && (
            <ErrorState
              title="Scan incomplete"
              body="The RPC rate-limited the on-chain scan before any registration could be read. This usually resolves within a minute or two."
              onRetry={() => refetch()}
            />
          )}

          {data.registrations.length === 0 && data.identity && (
            <RegistrationCard
              tokenId={data.identity.tokenId}
              address={data.address}
              metadataUri={data.identity.metadataUri}
              status="active"
            />
          )}

          {data.registrations.map((reg) => (
            <RegistrationCard
              key={reg.txHash + reg.tokenId}
              tokenId={reg.tokenId}
              txHash={reg.txHash}
              blockNumber={reg.blockNumber}
              timestamp={reg.timestamp}
              status={reg.status}
              address={data.address}
              metadataUri={reg.metadataUri}
            />
          ))}

          {data.olderTokensOutsideWindow && (
            <p className="t-xs c-subtle text-center">
              This wallet owns {data.balance} identity tokens — older registrations fall outside the scanned window.
            </p>
          )}

          {data.partialScan && (
            <p className="t-xs c-subtle text-center">
              Scan window limited by RPC rate limits — older registrations may not be listed.
            </p>
          )}
        </div>
      )}

      {data && data.registrations.length > 0 && (
        <Card style={{ marginTop: "var(--space-4)" }}>
          <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Next steps</p>
          <div className="grid gap-2">
            {[
              { label: "View your passport", href: `/passport/${address}`, icon: "🪪" },
              { label: "Get your first attestation", href: "/guide", icon: "📋" },
              { label: "Verify your identity", href: "/verify", icon: "✓" },
            ].map((step) => (
              <Link
                key={step.label}
                to={step.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface-1)",
                  textDecoration: "none",
                  color: "var(--color-on-surface)",
                  transition: "background 0.15s",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: "1rem" }}>{step.icon}</span>
                <span className="t-sm">{step.label}</span>
                <span style={{ marginLeft: "auto", color: "var(--color-subtle)", fontSize: "0.7rem" }}>→</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * RegisterPage — Identity registration with production-grade UX.
 */

import { useState, useEffect, useRef } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useReadContract } from "wagmi";
import { Link } from "react-router-dom";
import { ADDRESSES } from "../config/addresses";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { RegisterForm } from "../components/forms/RegisterForm";

// ── IdentityRegistry ABI (for re-registration guard) ──

const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "getIdentity",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "metadataURI", type: "string" },
    ],
    stateMutability: "view",
  },
] as const;

// ── Main Page ──

export function RegisterPage() {
  const { isConnected, address } = useWallet();
  const everTimedOut = useRef(false);

  // Re-registration guard — single fetch, no refetch on focus/refocus
  const { isLoading: checkingIdentity, isError: checkFailed } = useReadContract({
    address: ADDRESSES.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getIdentity",
    args: address ? [address] : undefined,
    query: {
      enabled: !!isConnected && !!address && !!ADDRESSES.identityRegistry,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
  });

  // Timeout: if check takes >4s, show the form — and never go back
  useEffect(() => {
    if (everTimedOut.current) return;
    if (!checkingIdentity) return;
    const timer = setTimeout(() => {
      everTimedOut.current = true;
    }, 4000);
    return () => clearTimeout(timer);
  }, [checkingIdentity]);

  const showForm = everTimedOut.current || !checkingIdentity || checkFailed;

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Identity Registration"
          title="Register Identity"
          description="Create your verifiable onchain identity on Arc."
        />
        <EmptyState
          title="Connect your wallet to register"
          body="You need a connected wallet on Arc Testnet to create an onchain identity."
          action={
            <Link to="/guide">
              <Button variant="ghost" size="sm">Read the Guide →</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Identity Registration"
        title="Register Identity"
        description="Create your verifiable onchain identity on Arc."
      />

      {showForm ? (
        <RegisterForm />
      ) : (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifyContent: "center", padding: "var(--space-6)" }}>
            <Spinner size={16} />
            <span className="t-sm c-subtle">Checking registration status…</span>
          </div>
        </Card>
      )}
    </div>
  );
}

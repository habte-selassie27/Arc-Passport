/**
 * RegisterPage — Thin wrapper. All logic lives in RegisterForm.
 * Only handles: connect-wallet gate, page header, spinner while form loads.
 */

import { useState, useEffect } from "react";
import { useWallet } from "../contexts/WalletContext";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { RegisterForm } from "../components/forms/RegisterForm";

const STORAGE_KEY = "arcpass_register_form_ready";

export function RegisterPage() {
  const { isConnected } = useWallet();
  const [formReady, setFormReady] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  });

  // Show form immediately on subsequent visits
  useEffect(() => {
    if (!formReady) {
      const t = setTimeout(() => {
        setFormReady(true);
        sessionStorage.setItem(STORAGE_KEY, "1");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [formReady]);

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
      {formReady ? (
        <RegisterForm />
      ) : (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifyContent: "center", padding: "var(--space-6)" }}>
            <Spinner size={16} />
            <span className="t-sm c-subtle">Loading form…</span>
          </div>
        </Card>
      )}
    </div>
  );
}

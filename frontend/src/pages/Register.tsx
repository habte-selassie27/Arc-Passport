import { RegisterForm } from "../components/forms/RegisterForm";
import { useWallet } from "../contexts/WalletContext";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";

export function RegisterPage() {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Identity Registration"
          title="Register Identity"
          description="Create your verifiable onchain identity."
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
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Identity Registration"
        title="Register Identity"
        description="Create your verifiable onchain identity."
      />
      <RegisterForm />
    </div>
  );
}

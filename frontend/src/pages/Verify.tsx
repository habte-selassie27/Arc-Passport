import { VerifyForm } from "../components/forms/VerifyForm";
import { PageHeader } from "../components/ui/PageHeader";

export function VerifyPage() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <PageHeader
        eyebrow="On-chain verification"
        title="Verify Credential"
        description="Check whether a wallet holds a valid attestation on-chain. Calls PassportVerifier.verify() directly — trustless, no backend required."
      />
      <VerifyForm />
    </div>
  );
}

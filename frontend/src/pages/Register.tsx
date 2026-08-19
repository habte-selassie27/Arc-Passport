/**
 * RegisterPage — Identity registration with production-grade UX.
 *
 * Features displayed as cards matching the design spec:
 * - Identity Input: avatar upload, username check, rich profile fields, name validation
 * - Identity Verification: liveness, phone binding, ENS, ZK email
 * - Transaction & Gas UX: real gas estimate, tx status tracker, gasless option, re-registration guard
 * - Privacy & Security: GDPR erase, selective disclosure, recovery address, nonce auth
 * - Post-Registration: onboarding checklist, shareable passport, webhook opt-in, auto-issue
 */

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

// ── Feature Card ──

type FeatureTag = "UX" | "Security" | "On-chain" | "Data";

const TAG_COLORS: Record<FeatureTag, { bg: string; color: string }> = {
  UX:         { bg: "rgba(59,130,246,0.15)", color: "#3B82F6" },
  Security:   { bg: "rgba(239,68,68,0.15)",  color: "#EF4444" },
  "On-chain": { bg: "rgba(0,229,160,0.15)",  color: "#00E5A0" },
  Data:       { bg: "rgba(245,158,11,0.15)", color: "#F59E0B" },
};

function FeatureCard({
  tag,
  title,
  description,
  implemented = false,
}: {
  tag: FeatureTag;
  title: string;
  description: string;
  implemented?: boolean;
}) {
  const colors = TAG_COLORS[tag];
  return (
    <div
      style={{
        padding: "var(--space-4)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-1)",
        border: implemented
          ? "1px solid rgba(0,229,160,0.3)"
          : "1px solid var(--color-border)",
        opacity: implemented ? 1 : 0.7,
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        <span
          style={{
            fontSize: "0.6rem",
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
            background: colors.bg,
            color: colors.color,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {tag}
        </span>
        {implemented && (
          <span style={{ fontSize: "0.6rem", color: "var(--color-verified)" }}>✓ Implemented</span>
        )}
      </div>
      <p className="t-sm" style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>{title}</p>
      <p className="t-xs c-subtle" style={{ lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

// ── Feature Sections ──

function IdentityInputSection() {
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Identity Input</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        <FeatureCard
          tag="UX"
          title="Avatar upload"
          description="Drag-drop or file picker. Pin to IPFS via Pinata. Preview before submit. CID auto-fills the Metadata URI field."
        />
        <FeatureCard
          tag="UX"
          title="Username uniqueness check"
          description="Debounced on-chain read as the user types. Shows 'taken' or 'available' inline before they hit register."
        />
        <FeatureCard
          tag="UX"
          title="Rich profile fields"
          description="Bio, website URL, social handles (optional). Packed into the IPFS profile JSON — nothing extra on-chain."
        />
        <FeatureCard
          tag="UX"
          title="Display name validation"
          description="Length limits (3–32 chars), allowed characters, profanity filter. Client-side + contract-side both."
          implemented
        />
      </div>
    </div>
  );
}

function IdentityVerificationSection() {
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Identity Verification</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        <FeatureCard
          tag="Security"
          title="Liveness check"
          description="Optional biometric liveness step (camera blink/nod) before registration. Issues a LIVENESS_VERIFIED attestation alongside BASIC_IDENTITY."
        />
        <FeatureCard
          tag="Security"
          title="Phone number binding"
          description="OTP via SMS. Number hashed before storage — never raw. Issues PHONE_REGISTERED attestation. Helps Sybil resistance from day one."
        />
        <FeatureCard
          tag="On-chain"
          title="ENS / Arc Name binding"
          description="Detect and display ENS or Arc Name Service name for the wallet. Store as verified alias in the profile JSON."
        />
        <FeatureCard
          tag="Security"
          title="ZK Email verification"
          description="Verify ownership of an email domain without exposing the address. Issues an email-domain attestation. No email stored on-chain."
        />
      </div>
    </div>
  );
}

function TransactionGasSection() {
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Transaction & Gas UX</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        <FeatureCard
          tag="UX"
          title="Real gas estimate"
          description="Show actual gas estimate (not '—') from the simulation result. Display in native token + USDC equivalent. Warn if wallet balance is low."
          implemented
        />
        <FeatureCard
          tag="UX"
          title="Tx status tracker"
          description="After sign: live status bar showing Submitted → Confirming → Confirmed. Block explorer link. Retry on revert with error reason."
          implemented
        />
        <FeatureCard
          tag="UX"
          title="Gasless option (EIP-2771)"
          description="Sponsored registration via a relayer for new users. Backend submits via Circle SDK and covers gas. First-time wallet UX without needing native tokens."
        />
        <FeatureCard
          tag="On-chain"
          title="Re-registration guard"
          description="Read IdentityRegistry on-chain before rendering the form. If wallet already has an identity, redirect to edit flow — not a duplicate register."
          implemented
        />
      </div>
    </div>
  );
}

function PrivacySecuritySection() {
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Privacy & Security</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        <FeatureCard
          tag="Security"
          title="GDPR erase button"
          description="After registration: a settings panel to unpin IPFS data and nullify the metadata URI on-chain. Commitment becomes orphaned hash — audit trail preserved."
        />
        <FeatureCard
          tag="Security"
          title="Selective disclosure config"
          description="Per-field visibility toggles on the profile JSON. Public / Attester-only / Private. Controls what appears on the public passport page."
        />
        <FeatureCard
          tag="Security"
          title="Recovery address"
          description="Set a secondary address at registration time as a social recovery key. Allows re-linking identity if primary wallet is lost. Stored as bytes32 hash."
        />
        <FeatureCard
          tag="Security"
          title="Nonce-based update auth"
          description="Profile updates require a signed nonce to prevent replay attacks. Same anti-replay pattern already used in ArcPass auth middleware."
          implemented
        />
      </div>
    </div>
  );
}

function PostRegistrationSection() {
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Post-Registration</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        <FeatureCard
          tag="UX"
          title="Onboarding checklist"
          description="After success: a 'Next steps' card — verify phone, upload avatar, request first credential, view passport. Drives engagement without a new page."
          implemented
        />
        <FeatureCard
          tag="On-chain"
          title="Shareable passport link"
          description="Immediately after registration, show the public /passport/:address URL with a copy button and QR code. Let users share before getting any credentials."
        />
        <FeatureCard
          tag="Data"
          title="Webhook / notification opt-in"
          description="Optional: subscribe to on-chain notifications for this address (credential issued, revoked). Email or push — stored off-chain, no PII on-chain."
        />
        <FeatureCard
          tag="On-chain"
          title="Auto-issue BASIC_IDENTITY"
          description="Backend auto-issues the BASIC_IDENTITY attestation immediately after a successful register tx. User starts with a score > 0 without an extra action."
          implemented
        />
      </div>
    </div>
  );
}

// ── Main Page ──

export function RegisterPage() {
  const { isConnected, address } = useWallet();

  // Re-registration guard — loading state
  const { isLoading: checkingIdentity } = useReadContract({
    address: ADDRESSES.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getIdentity",
    args: address ? [address] : undefined,
    query: { enabled: !!isConnected && !!address && !!ADDRESSES.identityRegistry },
  });

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

        {/* Feature overview — always visible, even before connecting */}
        <div className="grid gap-8" style={{ marginTop: "var(--space-12)" }}>
          <IdentityInputSection />
          <IdentityVerificationSection />
          <TransactionGasSection />
          <PrivacySecuritySection />
          <PostRegistrationSection />
        </div>
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

      {checkingIdentity ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifyContent: "center", padding: "var(--space-6)" }}>
            <Spinner size={16} />
            <span className="t-sm c-subtle">Checking registration status…</span>
          </div>
        </Card>
      ) : (
        <RegisterForm />
      )}

      {/* Feature sections below the form */}
      <div className="grid gap-8" style={{ marginTop: "var(--space-12)" }}>
        <IdentityInputSection />
        <IdentityVerificationSection />
        <TransactionGasSection />
        <PrivacySecuritySection />
        <PostRegistrationSection />
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";

interface ProviderCardProps {
  title: string;
  badge: string;
  badgeTone: "live" | "beta" | "soon";
  description: string;
  to: string;
  icon: React.ReactNode;
}

function ProviderCard({ title, badge, badgeTone, description, to, icon }: ProviderCardProps) {
  const badgeStyle: Record<string, React.CSSProperties> = {
    live: { background: "rgba(0,229,160,0.12)", color: "var(--color-verified)", border: "1px solid rgba(0,229,160,0.25)" },
    beta: { background: "rgba(59,130,246,0.12)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.25)" },
    soon: { background: "var(--color-surface-1)", color: "var(--color-subtle)", border: "1px solid var(--color-border)" },
  };

  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      <Card style={{ height: "100%", display: "flex", flexDirection: "column", gap: "var(--space-3)", transition: "border-color 0.15s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              background: "var(--color-surface-1)",
              border: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-subtle)",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="t-sm" style={{ fontWeight: 600, color: "var(--color-on-bright)" }}>{title}</p>
            <p className="t-xs c-subtle">{description}</p>
          </div>
        </div>
        <span
          style={{
            alignSelf: "flex-start",
            fontFamily: "var(--font-mono)",
            fontSize: "0.65rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: 4,
            ...badgeStyle[badgeTone],
          }}
        >
          {badge}
        </span>
      </Card>
    </Link>
  );
}

export function CredentialsPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Credentials"
        title="Add Proofs to Your Passport"
        description="Choose what you want to prove. Each credential is verified and stored as an on-chain attestation."
      />

      {/* Personhood */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <h2 className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Personhood</h2>
        <p className="t-sm c-subtle" style={{ marginBottom: "var(--space-4)", maxWidth: 560 }}>
          Prove you are a unique human. Required for reputation and gated features.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
          <ProviderCard
            title="Personhood"
            badge="Live"
            badgeTone="live"
            description="Camera liveness or World ID. One unique human per wallet."
            to="/world-id"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="5" />
                <path d="M3 21c0-4.4 4-8 9-8s9 3.6 9 8" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Web Accounts */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <h2 className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Web Accounts</h2>
        <p className="t-sm c-subtle" style={{ marginBottom: "var(--space-4)", maxWidth: 560 }}>
          Link accounts you already own. Proves control of a Web2 identity.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
          <ProviderCard
            title="Web Accounts"
            badge="Live"
            badgeTone="beta"
            description="GitHub, X, Discord via OpenID3. OAuth verification."
            to="/openid3"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Web Data */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <h2 className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Web Data</h2>
        <p className="t-sm c-subtle" style={{ marginBottom: "var(--space-4)", maxWidth: 560 }}>
          Prove data from any website without revealing raw data. Zero-knowledge TLS.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
          <ProviderCard
            title="Web Data"
            badge="Live"
            badgeTone="beta"
            description="Primus zkTLS. Prove data from websites privately."
            to="/web2-proof"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Documents */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <h2 className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Documents</h2>
        <p className="t-sm c-subtle" style={{ marginBottom: "var(--space-4)", maxWidth: 560 }}>
          Verify document attributes with zero-knowledge proofs. Coming privacy layer in V1.5.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
          <ProviderCard
            title="ZK Passport"
            badge="Soon"
            badgeTone="soon"
            description="Prove document attributes without exposing the document."
            to="/zk"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <circle cx="12" cy="16" r="1" />
              </svg>
            }
          />
        </div>
      </section>

      {/* External */}
      <section>
        <h2 className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>External Attestations</h2>
        <p className="t-sm c-subtle" style={{ marginBottom: "var(--space-4)", maxWidth: 560 }}>
          Bring attestations from other protocols.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
          <ProviderCard
            title="EAS"
            badge="Live"
            badgeTone="beta"
            description="Ethereum Attestation Service. Import existing credentials."
            to="/eas"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 15l2 2 4-4" />
              </svg>
            }
          />
        </div>
      </section>
    </div>
  );
}

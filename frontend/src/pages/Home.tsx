import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { Button } from "../components/ui/Button";

const FEATURES = [
  {
    to: "/passport",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="12" cy="10" r="3" />
        <path d="M8 18c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      </svg>
    ),
    title: "Passport",
    desc: "Your portable on-chain identity. Own your credentials, share them selectively.",
    color: "var(--color-arc-primary)",
  },
  {
    to: "/human-node",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="5" />
        <path d="M3 21c0-4.4 4-8 9-8s9 3.6 9 8" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: "Humanode",
    desc: "Proof of personhood. One unique human per account via biometric verification.",
    color: "var(--color-verified)",
  },
  {
    to: "/web2-proof",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Web2 Proof",
    desc: "Zero-knowledge TLS proofs. Prove Web2 data ownership without revealing raw data.",
    color: "#A78BFA",
  },
  {
    to: "/openid3",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    title: "OpenID3",
    desc: "Link Web2 identities. OAuth-based decentralized account ownership verification.",
    color: "#F59E0B",
  },
  {
    to: "/zk",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="1" />
      </svg>
    ),
    title: "ZK Passport",
    desc: "Zero-knowledge document verification. Prove attributes without exposing documents.",
    color: "#EC4899",
  },
  {
    to: "/eas",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    ),
    title: "EAS",
    desc: "Ethereum Attestation Service. Interoperable credential standard for the ecosystem.",
    color: "#06B6D4",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Connect",
    desc: "Link your wallet to start building your on-chain identity.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" />
        <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
        <circle cx="18" cy="16" r="2" />
        <circle cx="8" cy="10" r="2" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Verify",
    desc: "Prove humanity, link accounts, verify documents — all on-chain.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Attest",
    desc: "Receive cryptographic attestations stored immutably on-chain.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Share",
    desc: "Present your credentials to any dApp. One proof, universal trust.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
  },
];

export function HomePage() {
  const { isConnected } = useAccount();

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{ textAlign: "center", padding: "var(--space-20) 0 var(--space-12)", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: "var(--space-6)" }}>
          <span
            className="eyebrow"
            style={{
              display: "inline-block",
              padding: "var(--space-1) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-xs)",
              color: "var(--color-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono)",
            }}
          >
            Arc Testnet · Chain 5042002
          </span>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            lineHeight: 1.1,
            color: "var(--color-on-bright)",
            letterSpacing: "-0.02em",
          }}
        >
          Identity.{" "}
          <span style={{ color: "var(--color-verified)" }}>Attestation.</span>{" "}
          Verification.
        </h1>

        <p
          style={{
            marginTop: "var(--space-5)",
            fontSize: "var(--text-lg)",
            color: "var(--color-muted)",
            lineHeight: 1.7,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          A programmable identity layer for the Arc ecosystem. Build your passport,
          receive verifiable attestations, and prove what matters — on-chain.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)", marginTop: "var(--space-8)", flexWrap: "wrap" }}>
          {isConnected ? (
            <>
              <Link to="/passport">
                <Button>View My Passport</Button>
              </Link>
              <Link to="/human-node">
                <Button variant="ghost">Verify Humanity</Button>
              </Link>
            </>
          ) : (
            <>
              <Button disabled>Connect Wallet to Start</Button>
              <Link to="/guide">
                <Button variant="ghost">Read the Guide</Button>
              </Link>
            </>
          )}
        </div>

        {/* Trust indicators */}
        <div
          style={{
            marginTop: "var(--space-10)",
            display: "flex",
            justifyContent: "center",
            gap: "var(--space-6)",
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "On-Chain", value: "Immutable" },
            { label: "Standard", value: "EAS Compatible" },
            { label: "Network", value: "Arc Testnet" },
            { label: "Gas", value: "USDC" },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {item.label}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-on-surface)", marginTop: 2 }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-16) 0" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--text-xl)",
            color: "var(--color-on-bright)",
            textAlign: "center",
            marginBottom: "var(--space-2)",
          }}
        >
          How it works
        </h2>
        <p style={{ textAlign: "center", color: "var(--color-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-10)" }}>
          Four steps from wallet to verifiable identity
        </p>

        <div className="how-it-works">
          {STEPS.map((step, i) => (
            <div key={step.num} style={{ display: "contents" }}>
              <div className="how-it-works__step">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "var(--color-surface-1)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto var(--space-3)",
                    color: "var(--color-arc-primary)",
                  }}
                >
                  {step.icon}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-subtle)", marginBottom: 4 }}>
                  {step.num}
                </div>
                <div className="how-it-works__title">{step.title}</div>
                <div className="how-it-works__desc">{step.desc}</div>
              </div>
              {i < STEPS.length - 1 && (
                <span className="how-it-works__arrow" aria-hidden="true">→</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-8) 0 var(--space-16)" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--text-xl)",
            color: "var(--color-on-bright)",
            textAlign: "center",
            marginBottom: "var(--space-2)",
          }}
        >
          Everything you need
        </h2>
        <p style={{ textAlign: "center", color: "var(--color-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-10)" }}>
          One platform for identity, credentials, and verification
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {FEATURES.map((f) => (
            <Link
              key={f.to}
              to={f.to}
              className="card card--interactive"
              style={{ padding: "var(--space-5)", textDecoration: "none" }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--radius-md)",
                  background: `color-mix(in srgb, ${f.color} 10%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${f.color} 25%, transparent)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--space-3)",
                  color: f.color,
                }}
              >
                {f.icon}
              </div>
              <div className="card__title" style={{ marginBottom: "var(--space-1)" }}>{f.title}</div>
              <div className="card__desc">{f.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Three Roles ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-8) 0 var(--space-16)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {[
            {
              role: "Holder",
              title: "Own your identity",
              desc: "Build a portable on-chain passport. Receive attestations from issuers. Share credentials selectively with any verifier.",
              gradient: "linear-gradient(135deg, rgba(0,229,160,0.08) 0%, rgba(59,130,246,0.08) 100%)",
            },
            {
              role: "Issuer",
              title: "Issue credentials",
              desc: "Create schemas, issue attestations at scale. Manage revocation, expiration, and batch operations via the Studio.",
              gradient: "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(167,139,250,0.08) 100%)",
            },
            {
              role: "Verifier",
              title: "Verify on-chain",
              desc: "Check credential validity against the blockchain. Integrate gate contracts into your dApp for trustless verification.",
              gradient: "linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(236,72,153,0.08) 100%)",
            },
          ].map((r) => (
            <div
              key={r.role}
              style={{
                background: r.gradient,
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-6)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-xs)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--color-subtle)",
                  marginBottom: "var(--space-2)",
                }}
              >
                {r.role}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "var(--text-lg)",
                  color: "var(--color-on-bright)",
                  marginBottom: "var(--space-2)",
                }}
              >
                {r.title}
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)", lineHeight: 1.6 }}>
                {r.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        style={{
          maxWidth: 700,
          margin: "0 auto",
          padding: "var(--space-16) 0",
          textAlign: "center",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(0,229,160,0.06) 0%, rgba(59,130,246,0.06) 100%)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-10) var(--space-8)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--text-2xl)",
              color: "var(--color-on-bright)",
              marginBottom: "var(--space-3)",
            }}
          >
            Start building your identity
          </h2>
          <p style={{ color: "var(--color-muted)", fontSize: "var(--text-base)", maxWidth: 440, margin: "0 auto var(--space-6)", lineHeight: 1.7 }}>
            Connect your wallet, verify your humanity, link your accounts, and build
            a portable on-chain identity in minutes.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Link to="/register">
              <Button>Register Identity</Button>
            </Link>
            <Link to="/guide">
              <Button variant="ghost">Read the Guide</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

import { Link } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { WalletChip } from "../components/ui/WalletChip";
import { Eyebrow } from "../components/ui/Eyebrow";
import { Button } from "../components/ui/Button";

/** Decorative Merkle tree — references the commitment structure at the heart of ArcPass. */
function MerkleDecoration() {
  return (
    <svg className="hero__merkle" viewBox="0 0 200 120" fill="none" aria-hidden="true">
      {/* Root */}
      <rect x="88" y="4" width="24" height="8" rx="2" fill="var(--color-verified)" opacity="0.35" />
      {/* Level 1 */}
      <line x1="100" y1="12" x2="56" y2="30" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="100" y1="12" x2="144" y2="30" stroke="var(--color-border)" strokeWidth="1" />
      <rect x="44" y="30" width="24" height="8" rx="2" fill="var(--color-arc-primary)" opacity="0.25" />
      <rect x="132" y="30" width="24" height="8" rx="2" fill="var(--color-arc-primary)" opacity="0.25" />
      {/* Level 2 */}
      <line x1="56" y1="38" x2="32" y2="56" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="56" y1="38" x2="80" y2="56" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="144" y1="38" x2="120" y2="56" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="144" y1="38" x2="168" y2="56" stroke="var(--color-border)" strokeWidth="1" />
      <rect x="20" y="56" width="24" height="8" rx="2" fill="var(--color-arc-primary)" opacity="0.15" />
      <rect x="68" y="56" width="24" height="8" rx="2" fill="var(--color-arc-primary)" opacity="0.15" />
      <rect x="108" y="56" width="24" height="8" rx="2" fill="var(--color-arc-primary)" opacity="0.15" />
      <rect x="156" y="56" width="24" height="8" rx="2" fill="var(--color-arc-primary)" opacity="0.15" />
      {/* Leaves — claim commitments */}
      {[32, 80, 120, 168].map((x) => (
        <g key={x}>
          <line x1={x} y1="64" x2={x} y2="82" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 2" />
          <rect x={x - 6} y="82" width="12" height="12" rx="2" fill="var(--color-surface-2)" stroke="var(--color-border)" strokeWidth="1" />
          <circle cx={x} cy="88" r="2" fill="var(--color-verified)" opacity="0.6" />
        </g>
      ))}
      {/* Label */}
      <text x="100" y="112" textAnchor="middle" fill="var(--color-subtle)" fontSize="8" fontFamily="var(--font-mono)">
        dataCommitment
      </text>
    </svg>
  );
}

function HowItWorksIcon({ type }: { type: "key" | "passport" | "shield" }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (type === "key") {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="7.5" cy="15.5" r="4.5" />
        <path d="m10.7 12.3 8.8-8.8M16 6l3 3M13 9l3 3" />
      </svg>
    );
  }
  if (type === "passport") {
    return (
      <svg {...common} aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <circle cx="12" cy="11" r="2.5" />
        <path d="M9 17h6" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.4 3 8.4 7 9.5 4-1.1 7-5.1 7-9.5V6l-7-3Z" />
      <path d="m9 11.5 2 2 4-4" />
    </svg>
  );
}

const ACTION_CARDS = [
  {
    to: "/register",
    title: "Register Identity",
    desc: "Create your onchain identity",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
      </svg>
    ),
  },
  {
    to: "/schema",
    title: "Register Schema",
    desc: "Define new claim schema definitions",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h10" />
        <circle cx="19" cy="18" r="2" />
      </svg>
    ),
  },
  {
    to: "/passport",
    title: "View Passport",
    desc: "See your credentials in one place",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <circle cx="12" cy="11" r="2.5" />
        <path d="M9 17h6" />
      </svg>
    ),
  },
  {
    to: "/verify",
    title: "Verify Credential",
    desc: "Check a wallet holds a valid attestation on-chain",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 5 6v5c0 4.4 3 8.4 7 9.5 4-1.1 7-5.1 7-9.5V6l-7-3Z" />
        <path d="m9 11.5 2 2 4-4" />
      </svg>
    ),
  },
];

export function HomePage() {
  const { isConnected, address } = useWallet();

  return (
    <div className="animate-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero__content">
          <Eyebrow>Identity Infrastructure</Eyebrow>
          <h1 className="display t-hero" style={{ marginTop: "var(--space-4)", fontSize: "var(--text-hero)" }}>
            ArcPass
          </h1>
          <p className="hero__subtitle">
            Onchain identity, attestation &amp; passport protocol on Arc L1.
            Every credential is a cryptographic commitment — issued on-chain,
            verified trustlessly, revocable by the issuer.
          </p>
          <div className="hero__actions">
            <WalletChip />
            <Link to="/guide" className="btn btn--ghost">
              Read the Guide →
            </Link>
          </div>
          <div className="hero__meta">
            {isConnected && address ? (
              <>
                <span className="mono c-subtle">
                  Connected: <span className="c-verified">●</span>{" "}
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hero__meta-link"
                >
                  Testnet USDC ↗
                </a>
              </>
            ) : (
              <span className="mono">
                Connect a wallet to register an identity, hold credentials, and share your passport.
              </span>
            )}
          </div>
        </div>
        <MerkleDecoration />
      </section>

      {/* How it works */}
      <section className="how-it-works" aria-label="How it works">
        <div className="how-it-works__step">
          <div className="how-it-works__icon">
            <HowItWorksIcon type="key" />
          </div>
          <p className="how-it-works__title">Connect</p>
          <p className="how-it-works__desc">Link your wallet on Arc Testnet</p>
        </div>
        <div className="how-it-works__arrow" aria-hidden="true">→</div>
        <div className="how-it-works__step">
          <div className="how-it-works__icon">
            <HowItWorksIcon type="passport" />
          </div>
          <p className="how-it-works__title">Build passport</p>
          <p className="how-it-works__desc">Register your identity and collect credentials</p>
        </div>
        <div className="how-it-works__arrow" aria-hidden="true">→</div>
        <div className="how-it-works__step">
          <div className="how-it-works__icon">
            <HowItWorksIcon type="shield" />
          </div>
          <p className="how-it-works__title">Get attested</p>
          <p className="how-it-works__desc">Issuers verify claims on-chain — anyone can check</p>
        </div>
      </section>

      {/* Action grid */}
      <section aria-label="Actions">
        <div className="action-grid">
          {ACTION_CARDS.map((card) => (
            <Link key={card.to} to={card.to} className="action-card">
              <span className="action-card__icon">{card.icon}</span>
              <span>
                <span className="action-card__title">{card.title}</span>
                <span className="action-card__desc">{card.desc}</span>
              </span>
              <span className="action-card__arrow" aria-hidden="true">→</span>
            </Link>
          ))}

          {/* Featured issuer card */}
          <Link to="/issue" className="action-card action-card--featured">
            <span className="action-card__icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5" />
                <path d="M14 3l7 7-7 7-7-7 7-7Z" />
                <path d="M10.5 13.5 14 17l7-7" />
              </svg>
            </span>
            <span className="flex-1">
              <span className="action-card__title">Issuer Studio</span>
              <span className="action-card__desc">
                Issue attestations, manage schemas, bulk operations
              </span>
            </span>
            <span className="chip chip--pending">Issuer role required</span>
            <span className="action-card__arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

import { Link, Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { StatCounter } from "../components/landing/StatCounter";

const FEATURES = [
  {
    to: "/passport",
    tag: "IDENTITY",
    tagClass: "feature-card__tag--identity",
    iconClass: "feature-card__icon--identity",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="12" cy="10" r="3" />
        <path d="M8 18c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      </svg>
    ),
    title: "Passport",
    desc: "Your portable on-chain identity. Own your credentials, share them selectively.",
    schemas: "BASIC_IDENTITY · LIVENESS_VERIFIED",
  },
  {
    to: "/world-id",
    tag: "IDENTITY",
    tagClass: "feature-card__tag--identity",
    iconClass: "feature-card__icon--identity",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="5" />
        <path d="M3 21c0-4.4 4-8 9-8s9 3.6 9 8" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: "Humanity proof",
    desc: "One unique human per account. Biometric verification anchored on-chain.",
    schemas: "HUMANITY_PROOF",
  },
  {
    to: "/web2-proof",
    tag: "WEB DATA",
    tagClass: "feature-card__tag--webdata",
    iconClass: "feature-card__icon--webdata",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Web accounts",
    desc: "OAuth-based decentralized account ownership verification for Web2 identities.",
    schemas: "SOCIAL_ACCOUNT · WEB_DATA_PROOF",
  },
  {
    to: "/openid3",
    tag: "WEB DATA",
    tagClass: "feature-card__tag--webdata",
    iconClass: "feature-card__icon--webdata",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    title: "Web data",
    desc: "Zero-knowledge TLS proofs. Prove Web2 data ownership without revealing raw data.",
    schemas: "WEB_DATA_PROOF",
  },
  {
    to: "/zk",
    tag: "ZK",
    tagClass: "feature-card__tag--zk",
    iconClass: "feature-card__icon--zk",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="1" />
      </svg>
    ),
    title: "ZK Passport",
    desc: "Merkle-based selective disclosure. Prove attributes without exposing documents.",
    schemas: "verifyField()",
  },
  {
    to: "/eas",
    tag: "EAS COMPATIBLE",
    tagClass: "feature-card__tag--eas",
    iconClass: "feature-card__icon--eas",
    verified: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    ),
    title: "Attestation Service",
    desc: "Interoperable credential standard. EAS-compatible attestation registry for the ecosystem.",
    schemas: "AttestRegistry",
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

  if (isConnected) {
    return <Navigate to="/passport" replace />;
  }

  return (
    <div>
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__grid" aria-hidden="true" />

        <div className="hero__content">
          <div className="hero__eyebrow">
            <span className="hero-eyebrow-dot" aria-hidden="true" />
            ARC TESTNET · CHAIN 5042002 · EAS COMPATIBLE
          </div>

          <h1 className="hero__headline">
            <span className="hero__headline-line hero__headline--primary">Identity.</span>
            <span className="hero__headline-line hero__headline--verified">Attestation.</span>
            <span className="hero__headline-line hero__headline--muted">Verification.</span>
          </h1>

          <p className="hero__subtitle">
            A programmable identity layer for the Arc ecosystem. Build your passport,
            receive verifiable attestations, and prove what matters — on-chain.
          </p>

          <div className="hero__actions">
            <Link to="/register" className="btn btn--primary btn--md">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 6 }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Connect Wallet to Start
            </Link>
            <Link to="/guide" className="btn btn--ghost btn--md">
              Read the Guide →
            </Link>
          </div>

          <div className="hero__stats-strip">
            <div className="hero__stats-cell">
              <div className="hero__stats-label">Standard</div>
              <div className="hero__stats-value">EAS</div>
              <div className="hero__stats-sub">Compatible</div>
            </div>
            <div className="hero__stats-cell">
              <div className="hero__stats-label">On-chain</div>
              <div className="hero__stats-value hero__stats-value--verified">Immutable</div>
              <div className="hero__stats-sub">Permanent</div>
            </div>
            <div className="hero__stats-cell">
              <div className="hero__stats-label">Network</div>
              <div className="hero__stats-value hero__stats-value--arc">Arc Testnet</div>
              <div className="hero__stats-sub">Chain 5042002</div>
            </div>
            <div className="hero__stats-cell">
              <div className="hero__stats-label">Gas</div>
              <div className="hero__stats-value">USDC</div>
              <div className="hero__stats-sub">Native</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Protocol Stats Band ── */}
      <div className="stats-band">
        <div className="stats-band__grid">
          <div className="stats-band__cell">
            <div className="stats-band__label">Total credentials issued</div>
            <StatCounter target={24891} className="stats-band__number" />
            <div className="stats-band__sub">Across 9 service verticals</div>
          </div>
          <div className="stats-band__cell">
            <div className="stats-band__label">Registered identities</div>
            <StatCounter target={3240} className="stats-band__number" />
            <div className="stats-band__sub">Unique wallets</div>
          </div>
          <div className="stats-band__cell">
            <div className="stats-band__label">Canonical schemas</div>
            <StatCounter target={24} className="stats-band__number" />
            <div className="stats-band__sub">KYC, DAO, Edu...</div>
          </div>
          <div className="stats-band__cell">
            <div className="stats-band__label">Authorized issuers</div>
            <StatCounter target={147} className="stats-band__number" />
            <div className="stats-band__sub">Vetted authorities</div>
          </div>
        </div>
      </div>

      {/* ── How It Works ── */}
      <section className="section">
        <p className="section__eyebrow">PROTOCOL FLOW</p>
        <h2 className="section__title">How it works</h2>
        <p className="section__desc">Four steps from wallet to verifiable identity</p>

        <div className="how-it-works-grid">
          {STEPS.map((step, i) => (
            <div key={step.num} className="how-it-works-cell">
              <div className="how-it-works-cell__num">{step.num}</div>
              <div className="how-it-works-cell__icon">{step.icon}</div>
              <div className="how-it-works-cell__title">{step.title}</div>
              <div className="how-it-works-cell__desc">{step.desc}</div>
              {i < STEPS.length - 1 && (
                <span className="how-it-works-arrow" aria-hidden="true">→</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <h2 className="section__title">One platform. Every trust signal.</h2>

        <div className="features-grid">
          {FEATURES.map((f) => (
            <Link
              key={f.to}
              to={f.to}
              className={`feature-card ${f.verified ? "feature-card--verified" : ""}`}
            >
              <span className={`feature-card__tag ${f.tagClass}`}>{f.tag}</span>
              <div className={`feature-card__icon ${f.iconClass}`}>{f.icon}</div>
              <div className="feature-card__title">{f.title}</div>
              <div className="feature-card__desc">{f.desc}</div>
              <div className="feature-card__schemas">
                <span className="feature-card__schemas-dot" aria-hidden="true" />
                <span className="feature-card__schemas-text">{f.schemas}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Code Band ── */}
      <div className="code-band">
        <div className="code-band__inner">
          <div className="code-band__left">
            <p className="section__eyebrow">DEVELOPER INTEGRATION</p>
            <h2 className="code-band__title">Verify credentials<br />in three lines</h2>
            <p className="code-band__desc">
              ArcPass contracts are deployed and ready. Integrate on-chain
              credential verification into your dApp with a single function call.
            </p>
            <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" className="code-band__link">
              Contract addresses ↗
            </a>
            <br />
            <a href="#" className="code-band__link">
              ABI reference ↗
            </a>
            <br />
            <a href="#" className="code-band__link">
              OpenAPI spec ↗
            </a>
          </div>

          <div className="code-block">
            <div className="code-block__header">
              <div className="code-block__dots">
                <span className="code-block__dot code-block__dot--red" />
                <span className="code-block__dot code-block__dot--yellow" />
                <span className="code-block__dot code-block__dot--green" />
              </div>
              <span className="code-block__filename">verify.sol</span>
            </div>
            <pre className="code-block__body">{`<span class="comment">// Check a credential in one call</span>
<span class="keyword">import</span> {<span class="type">IPassportVerifier</span>} <span class="keyword">from</span> <span class="string">"arc/PassportVerifier.sol"</span>;

<span class="type">IPassportVerifier</span> <span class="var">verifier</span> = <span class="type">IPassportVerifier</span>(
    <span class="const">VERIFIER_ADDR</span>
);

<span class="keyword">bool</span> <span class="var">passes</span> = <span class="var">verifier</span>.<span class="func">verify</span>(
    <span class="var">userAddress</span>,
    <span class="const">KYC_BASIC_ID</span>
);

<span class="keyword">require</span>(<span class="var">passes</span>, <span class="string">"ArcPass required"</span>);`}</pre>
          </div>
        </div>
      </div>

      {/* ── Roles ── */}
      <section className="section">
        <h2 className="section__title">Built for every participant</h2>

        <div className="roles-grid">
          <div className="role-card">
            <div className="role-card__tag">— HOLDER</div>
            <div className="role-card__title">Own your identity</div>
            <p className="role-card__desc">
              Build a portable on-chain passport. Receive attestations from issuers.
              Share credentials selectively with any verifier.
            </p>
            <ul className="role-card__list">
              <li className="role-card__item"><span className="role-card__bullet">→</span> Register once</li>
              <li className="role-card__item"><span className="role-card__bullet">→</span> Selective ZK disclosure</li>
              <li className="role-card__item"><span className="role-card__bullet">→</span> GDPR erasure</li>
              <li className="role-card__item"><span className="role-card__bullet">→</span> Public URL</li>
            </ul>
          </div>

          <div className="role-card">
            <div className="role-card__tag">— ISSUER</div>
            <div className="role-card__title">Issue credentials</div>
            <p className="role-card__desc">
              Create schemas, issue attestations at scale. Manage revocation,
              expiration, and batch operations via the Studio.
            </p>
            <ul className="role-card__list">
              <li className="role-card__item"><span className="role-card__bullet">→</span> 24 schemas ready</li>
              <li className="role-card__item"><span className="role-card__bullet">→</span> Bulk 100/tx</li>
              <li className="role-card__item"><span className="role-card__bullet">→</span> EIP-191 delegated</li>
              <li className="role-card__item"><span className="role-card__bullet">→</span> Analytics</li>
            </ul>
          </div>

          <div className="role-card">
            <div className="role-card__tag">— VERIFIER</div>
            <div className="role-card__title">Verify on-chain</div>
            <p className="role-card__desc">
              Check credential validity against the blockchain. Integrate gate
              contracts into your dApp for trustless verification.
            </p>
            <ul className="role-card__list">
              <li className="role-card__item"><span className="role-card__bullet">→</span> verify() one call</li>
              <li className="role-card__item"><span className="role-card__bullet">→</span> KycGate, DaoGate</li>
              <li className="role-card__item"><span className="role-card__bullet">→</span> Batch verify</li>
              <li className="role-card__item"><span className="role-card__bullet">→</span> Revocation detect</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="cta-box">
          <div className="cta-box__glow" aria-hidden="true" />
          <h2 className="cta-box__title">
            Start building your<br />
            <span className="cta-box__title--verified">identity</span>
          </h2>
          <p className="cta-box__desc">
            Connect your wallet, verify your humanity, link your accounts,
            and build a portable on-chain identity in minutes.
          </p>
          <div className="cta-box__actions">
            <Link to="/register" className="btn btn--primary btn--md">Register Identity</Link>
            <Link to="/guide" className="btn btn--ghost btn--md">Read the Guide</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer__left">
          ArcPass<span className="landing-footer__sep">·</span>identity<span className="landing-footer__sep">·</span>attestation<span className="landing-footer__sep">·</span>verification<span className="landing-footer__sep">·</span>Arc Testnet<span className="landing-footer__sep">·</span>chain 5042002
        </div>
        <div className="landing-footer__links">
          <a href="#" className="landing-footer__link">Docs</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="landing-footer__link">GitHub</a>
          <a href="#" className="landing-footer__link">API</a>
          <a href="#" className="landing-footer__link">Status</a>
        </div>
      </footer>
    </div>
  );
}

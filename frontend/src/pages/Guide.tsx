import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Callout } from "../components/ui/Callout";
import { CodeBlock } from "../components/ui/CodeBlock";
import { Button } from "../components/ui/Button";

interface StepProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

function Step({ number, title, children }: StepProps) {
  return (
    <section className="card section">
      <p className="eyebrow" style={{ marginBottom: "var(--space-1)" }}>
        Step {number}
      </p>
      <h2 className="display--medium t-xl" style={{ marginBottom: "var(--space-4)" }}>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const bodyStyle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-muted)",
  lineHeight: 1.7,
};

const strongStyle: React.CSSProperties = {
  color: "var(--color-on-bright)",
  fontWeight: 500,
};

export function GuidePage() {
  return (
    <div className="animate-page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Getting started"
        title="How to Use ArcPass"
        description="A beginner-friendly walkthrough. No crypto experience needed — we explain everything as we go."
      />

      {/* Dashed vertical connector between steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Step number="01" title="What is ArcPass? (Plain English)">
          <p style={bodyStyle}>
            ArcPass is a digital passport for your crypto wallet. Instead of showing a physical ID
            or filling out forms on every website, you register once and let issuers (like KYC
            providers, employers, or DAOs) attach verified claims to your wallet address.
          </p>
          <p style={bodyStyle}>
            Think of it like a LinkedIn profile that lives on the blockchain: employers, schools,
            and verification services can add credentials to your wallet, and you choose what to
            share with each website you visit.
          </p>
          <Callout type="tip">
            <strong style={strongStyle}>Your data stays private.</strong> ArcPass stores only a
            Merkle commitment on-chain — never raw personal data. Each credential is a
            cryptographic commitment; you decide what to reveal and to whom.
          </Callout>
        </Step>

        <Step number="02" title="Install a wallet">
          <p style={bodyStyle}>
            You need a crypto wallet to use ArcPass. This is like a digital ID card that lives in
            your browser.
          </p>
          <ul style={{ ...bodyStyle, paddingLeft: "var(--space-5)", listStyle: "disc" }}>
            <li>
              <strong style={strongStyle}>MetaMask</strong> (recommended for beginners) —{" "}
              <a href="https://metamask.io/download" target="_blank" rel="noopener noreferrer">
                install from metamask.io
              </a>
            </li>
            <li>
              <strong style={strongStyle}>Injected wallet</strong> — if you already have a browser
              wallet, it should work automatically
            </li>
          </ul>
        </Step>

        <Step number="03" title="Connect to Arc Testnet">
          <p style={bodyStyle}>
            ArcPass runs on <strong style={strongStyle}>Arc Testnet</strong>, a test version of the
            Arc blockchain. Everything is free — you use play money, not real money.
          </p>
          <ol style={{ ...bodyStyle, paddingLeft: "var(--space-5)", listStyle: "decimal" }}>
            <li>
              Open MetaMask, click the network dropdown, and choose "Add Network Manually".
            </li>
            <li>
              Enter these details:
              <CodeBlock style={{ marginTop: "var(--space-3)" }}>
                <span className="t-key">Network name:</span> <span className="t-val">Arc Testnet</span>{" "}
                <span className="t-comment">// USDC-native L1</span>
                {"\n"}
                <span className="t-key">RPC URL:</span>{" "}
                <span className="t-val">https://rpc.testnet.arc.network</span>
                {"\n"}
                <span className="t-key">Chain ID:</span> <span className="t-val">5042002</span>
                {"\n"}
                <span className="t-key">Currency:</span> <span className="t-val">USDC</span>
                {"\n"}
                <span className="t-key">Block explorer:</span>{" "}
                <span className="t-val">https://testnet.arcscan.app</span>
              </CodeBlock>
            </li>
            <li>Click "Save" — you should now see "Arc Testnet" in your network list.</li>
          </ol>
          <Callout type="info">
            Already connected? Click the <strong style={strongStyle}>Connect Wallet</strong> button
            at the top right of this page and approve the connection in your wallet.
          </Callout>
        </Step>

        <Step number="04" title="Get free testnet USDC (gas money)">
          <p style={bodyStyle}>
            Even though everything is testnet, you need a tiny bit of USDC to pay for transaction
            fees (like a stamp for mail).
          </p>
          <ol style={{ ...bodyStyle, paddingLeft: "var(--space-5)", listStyle: "decimal" }}>
            <li>
              Go to the{" "}
              <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
                Circle Faucet
              </a>
              .
            </li>
            <li>
              Select <strong style={strongStyle}>Arc Testnet</strong> and enter your wallet address.
            </li>
            <li>
              Click "Request tokens" — you will receive free testnet USDC within a few seconds.
            </li>
          </ol>
          <Callout type="warn">
            This is <strong style={strongStyle}>testnet play money</strong>. It has no real value.
            You can request as much as you need for testing.
          </Callout>
        </Step>

        <Step number="05" title="Register your identity">
          <p style={bodyStyle}>
            Now that your wallet is set up and funded, you can create your onchain identity. This is
            like creating a profile — but it lives on the blockchain.
          </p>
          <ol style={{ ...bodyStyle, paddingLeft: "var(--space-5)", listStyle: "decimal" }}>
            <li>Click the <strong style={strongStyle}>Register</strong> link in the navigation.</li>
            <li>Enter a display name (e.g., "Alice").</li>
            <li>The metadata URI field is pre-filled with a placeholder — you can leave it as-is.</li>
            <li>
              Click <strong style={strongStyle}>Register Identity</strong>. Your wallet will ask you
              to confirm and sign a transaction.
            </li>
            <li>
              Wait a few seconds — Arc confirms transactions in under a second. You will see a
              verified success state.
            </li>
          </ol>
          <Callout type="tip">
            Signing a transaction is like signing a digital document. Your wallet shows you what the
            transaction does before you approve it. Always read the details before confirming.
          </Callout>
        </Step>

        <Step number="06" title="View your passport">
          <p style={bodyStyle}>
            After registering, your passport page shows all your credentials in one place.
          </p>
          <ol style={{ ...bodyStyle, paddingLeft: "var(--space-5)", listStyle: "decimal" }}>
            <li>Click <strong style={strongStyle}>Passport</strong> in the navigation.</li>
            <li>
              You will see your wallet address and any credentials that have been issued to you.
            </li>
            <li>
              If no credentials appear yet, don't worry — the passport shows claims from{" "}
              <em>issuers</em>. In the next step you will learn how to get verified.
            </li>
          </ol>
          <Callout type="info">
            You can view <strong style={strongStyle}>anyone's</strong> passport by going to{" "}
            <code className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
              /passport/0x...
            </code>{" "}
            with their address.
          </Callout>
        </Step>

        <Step number="07" title="Get verified (find an issuer)">
          <p style={bodyStyle}>
            An <strong style={strongStyle}>issuer</strong> is someone who can attach a credential to
            your passport — like a KYC provider verifying your identity or an employer confirming
            your job title.
          </p>
          <p style={bodyStyle}>
            On the testnet, you can try the verification flow by checking existing passports. To
            issue credentials yourself, you need <strong style={strongStyle}>ISSUER_ROLE</strong> —
            contact the project admin to become an issuer.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            <Link to="/services/kyc" className="btn btn--ghost btn--sm">
              Check KYC status
            </Link>
            <Link to="/services/credentials" className="btn btn--ghost btn--sm">
              View credentials
            </Link>
            <Link to="/services/reputation" className="btn btn--ghost btn--sm">
              Check reputation
            </Link>
          </div>
        </Step>

        <Step number="08" title="Verify someone else's credential">
          <p style={bodyStyle}>
            If you run a dApp or service, you can verify that a user holds a valid credential
            before granting them access.
          </p>
          <ol style={{ ...bodyStyle, paddingLeft: "var(--space-5)", listStyle: "decimal" }}>
            <li>Click <strong style={strongStyle}>Verify</strong> in the navigation.</li>
            <li>
              Enter the user's wallet address and pick the credential type (e.g., "KYC Basic") from
              the dropdown.
            </li>
            <li>
              Click <strong style={strongStyle}>Verify Credential</strong>. The result tells you
              whether the credential is valid, who issued it, and when it expires.
            </li>
          </ol>
          <Callout type="warn">
            <strong style={strongStyle}>Always verify on-chain.</strong> Never trust a credential
            claim without calling the verify function — checking is free and instant.
          </Callout>
        </Step>

        <Step number="09" title="For issuers: issue and revoke">
          <p style={bodyStyle}>
            If you hold the ISSUER_ROLE, you can issue attestations to other wallets and revoke them
            when needed.
          </p>
          <ol style={{ ...bodyStyle, paddingLeft: "var(--space-5)", listStyle: "decimal" }}>
            <li>Click <strong style={strongStyle}>Issue</strong> in the navigation.</li>
            <li>Your wallet will prompt you to sign a message to verify you are an issuer.</li>
            <li>
              Once verified, you can issue attestations by filling in the subject address, schema,
              and data.
            </li>
            <li>
              Use the Studio for advanced features: bulk CSV issuance, schema templates, and
              per-service analytics.
            </li>
          </ol>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Link to="/issue">
              <Button variant="primary" size="sm">Open Issuer Dashboard</Button>
            </Link>
            <Link to="/studio">
              <Button variant="ghost" size="sm">Open Studio</Button>
            </Link>
          </div>
        </Step>

        <Step number="10" title="Troubleshooting">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div>
              <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--color-on-bright)" }}>
                "Wallet not connected"
              </p>
              <p style={bodyStyle}>
                Make sure MetaMask (or your wallet) is unlocked and connected to{" "}
                <strong style={strongStyle}>Arc Testnet</strong>. Click the "Connect Wallet" button
                at the top right. If it still doesn't work, try refreshing the page.
              </p>
            </div>
            <div>
              <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--color-on-bright)" }}>
                "Not enough USDC for gas"
              </p>
              <p style={bodyStyle}>
                You need a tiny amount of testnet USDC in your wallet to pay for transaction fees.
                Go to the{" "}
                <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
                  Circle Faucet
                </a>{" "}
                and request testnet USDC for Arc Testnet.
              </p>
            </div>
            <div>
              <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--color-on-bright)" }}>
                "Passport shows no data"
              </p>
              <p style={bodyStyle}>
                The passport API needs the backend server running. If you see "Backend offline" on
                the passport page, start the backend with{" "}
                <code className="mono t-xs" style={{ color: "var(--color-muted)" }}>npm run dev</code>{" "}
                in the backend/ directory.
              </p>
            </div>
            <div>
              <p style={{ ...bodyStyle, fontWeight: 500, color: "var(--color-on-bright)" }}>
                "Transaction failed"
              </p>
              <p style={bodyStyle}>
                If a transaction fails, the error message usually tells you why. Common reasons: you
                don't have the required role (ISSUER_ROLE), the claim already exists, or the schema
                is already registered.
              </p>
            </div>
          </div>
        </Step>
      </div>

      <div style={{ textAlign: "center", paddingTop: "var(--space-10)", paddingBottom: "var(--space-8)" }}>
        <p className="c-subtle t-sm" style={{ marginBottom: "var(--space-4)" }}>
          Ready to get started?
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Link to="/register">
            <Button>Register Your Identity</Button>
          </Link>
          <Link to="/passport">
            <Button variant="ghost">View Passport</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

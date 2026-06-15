import { Link } from "react-router-dom";

interface StepProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

function Step({ number, title, children }: StepProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start gap-4">
        <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white text-lg font-bold">
          {number}
        </span>
        <div className="space-y-3 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
      {children}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300">
      {children}
    </div>
  );
}

export function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 animate-fade-in space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          How to Use ArcPass
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          A beginner-friendly walkthrough. No crypto experience needed — we explain
          everything as we go.
        </p>
      </div>

      <div className="grid gap-6">
        <Step number="1" title="What is ArcPass? (Plain English)">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            ArcPass is a digital passport for your crypto wallet. Instead of showing
            a physical ID or filling out forms on every website, you register once and
            let issuers (like KYC providers, employers, or DAOs) attach verified claims
            to your wallet address.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Think of it like a LinkedIn profile that lives on the blockchain:
            employers, schools, and verification services can add credentials to your
            wallet, and you choose what to share with each website you visit.
          </p>
          <Tip>
            <strong>You control your data.</strong> ArcPass never exposes your personal
            information publicly. Each credential is a cryptographic commitment — you
            decide what to reveal and to whom.
          </Tip>
        </Step>

        <Step number="2" title="Install a wallet">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            You need a crypto wallet to use ArcPass. This is like a digital ID card
            that lives in your browser.
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc pl-5">
            <li>
              <strong>MetaMask</strong> (recommended for beginners) —
              <a
                href="https://metamask.io/download"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
              >
                install from metamask.io
              </a>
            </li>
            <li>
              <strong>WalletConnect</strong> — works with most mobile wallets
            </li>
            <li>
              <strong>Injected wallet</strong> — if you already have a browser wallet,
              it should work automatically
            </li>
          </ul>
        </Step>

        <Step number="3" title="Connect to Arc Testnet">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            ArcPass runs on <strong>Arc Testnet</strong>, a test version of the Arc
            blockchain. Everything is free — you use play money, not real money.
          </p>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal pl-5">
            <li>
              Open MetaMask, click the network dropdown at the top, and choose
              &quot;Add Network&quot; (or &quot;Add Network Manually&quot;).
            </li>
            <li>
              Enter these details:
              <div className="mt-2 bg-gray-50 dark:bg-gray-900/50 rounded p-3 text-xs font-mono text-gray-700 dark:text-gray-300 space-y-1">
                <p><strong>Network name:</strong> Arc Testnet</p>
                <p><strong>RPC URL:</strong> https://rpc.testnet.arc.network</p>
                <p><strong>Chain ID:</strong> 5042002</p>
                <p><strong>Currency:</strong> USDC</p>
                <p><strong>Block explorer:</strong> https://testnet.arcscan.app</p>
              </div>
            </li>
            <li>Click &quot;Save&quot; — you should now see &quot;Arc Testnet&quot; in your network list.</li>
          </ol>
          <Tip>
            Already connected? Click the <strong>&quot;Connect Wallet&quot;</strong> button at the
            top right of this page and approve the connection in your wallet.
          </Tip>
        </Step>

        <Step number="4" title="Get free testnet USDC (gas money)">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Even though everything is testnet, you need a tiny bit of USDC to pay for
            transaction fees (like a stamp for mail).
          </p>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal pl-5">
            <li>
              Go to the{" "}
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Circle Faucet
              </a>
              .
            </li>
            <li>
              Select <strong>Arc Testnet</strong> and enter your wallet address
              (you can copy it from MetaMask).
            </li>
            <li>Click &quot;Request tokens&quot; — you will receive free testnet USDC within a few seconds.</li>
          </ol>
          <Warn>
            This is <strong>testnet play money</strong>. It has no real value. You
            can request as much as you need for testing.
          </Warn>
        </Step>

        <Step number="5" title="Register your identity">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Now that your wallet is set up and funded, you can create your onchain identity.
            This is like creating a profile — but it lives on the blockchain.
          </p>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal pl-5">
            <li>Click the <strong>&quot;Register&quot;</strong> link in the navigation bar at the top.</li>
            <li>Enter a display name (e.g., &quot;Alice&quot;).</li>
            <li>
              The metadata URI field is pre-filled with a placeholder — you can leave
              it as-is for now.
            </li>
            <li>
              Click <strong>&quot;Register Identity&quot;</strong>. Your wallet will ask you to
              confirm and sign a transaction.
            </li>
            <li>
              Wait a few seconds — Arc confirms transactions in under a second. You
              will see a green success message.
            </li>
          </ol>
          <Tip>
            Signing a transaction is like signing a digital document. Your wallet shows
            you what the transaction does before you approve it. Always read the
            details before confirming.
          </Tip>
        </Step>

        <Step number="6" title="View your passport">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            After registering, your passport page shows all your credentials in one
            place.
          </p>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal pl-5">
            <li>Click <strong>&quot;Passport&quot;</strong> in the navigation bar.</li>
            <li>
              You will see your wallet address and any credentials that have been
              issued to you.
            </li>
            <li>
              If no credentials appear yet, don&apos;t worry — the passport shows
              claims from <em>issuers</em>. In the next step, you will learn how to
              get verified.
            </li>
          </ol>
          <Tip>
            You can view <strong>anyone&apos;s</strong> passport by going to
            <code className="mx-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              /passport/0x...
            </code>
            with their address.
          </Tip>
        </Step>

        <Step number="7" title="Get verified (find an issuer)">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            An <strong>issuer</strong> is someone who can attach a credential to your
            passport — like a KYC provider verifying your identity or an employer
            confirming your job title.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            On the testnet, you can try the verification flow by checking existing
            passports. To issue credentials yourself, you need the
            <strong> ISSUER_ROLE</strong> — contact the project admin to become an
            issuer.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              to="/services/kyc"
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
            >
              Check KYC status
            </Link>
            <Link
              to="/services/credentials"
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
            >
              View credentials
            </Link>
            <Link
              to="/services/reputation"
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
            >
              Check reputation
            </Link>
          </div>
        </Step>

        <Step number="8" title="Verify someone else&apos;s credential">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            If you run a dApp or service, you can verify that a user holds a valid
            credential before granting them access.
          </p>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal pl-5">
            <li>Click <strong>&quot;Verify&quot;</strong> in the navigation bar.</li>
            <li>
              Enter the user&apos;s wallet address and pick the credential type
              (e.g., &quot;KYC Basic&quot;) from the dropdown.
            </li>
            <li>
              Click <strong>&quot;Verify Credential&quot;</strong>. The result tells you
              whether the credential is valid, who issued it, and when it expires.
            </li>
          </ol>
          <Warn>
            <strong>Always verify onchain.</strong> Never trust a credential claim
            without calling the verify function — checking is free and instant.
          </Warn>
        </Step>

        <Step number="9" title="For issuers: issue and revoke">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            If you hold the ISSUER_ROLE, you can issue attestations to other wallets
            and revoke them when needed.
          </p>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal pl-5">
            <li>Click <strong>&quot;Issue&quot;</strong> in the navigation bar.</li>
            <li>Your wallet will prompt you to sign a message to verify you are an issuer.</li>
            <li>
              Once verified, you can issue attestations by filling in the subject
              address, schema, and data.
            </li>
            <li>
              Use the Studio for advanced features: bulk CSV issuance, schema
              templates, and per-service analytics.
            </li>
          </ol>
          <div className="flex gap-2 mt-3">
            <Link
              to="/issue"
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
            >
              Open Issuer Dashboard
            </Link>
            <Link
              to="/studio"
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Open Studio
            </Link>
          </div>
        </Step>

        <Step number="10" title="Troubleshooting">
          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">
                &quot;Wallet not connected&quot;
              </p>
              <p>
                Make sure MetaMask (or your wallet) is unlocked and connected to
                <strong> Arc Testnet</strong>. Click the &quot;Connect Wallet&quot;
                button at the top right. If it still doesn&apos;t work, try refreshing
                the page.
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">
                &quot;Not enough USDC for gas&quot;
              </p>
              <p>
                You need a tiny amount of testnet USDC in your wallet to pay for
                transaction fees. Go to the{" "}
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Circle Faucet
                </a>{" "}
                and request testnet USDC for Arc Testnet.
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">
                &quot;Passport shows no data&quot;
              </p>
              <p>
                The passport API needs the backend server running. If you see
                &quot;Backend offline&quot; on the passport page, start the backend
                with <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">npm run dev</code>
                in the <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">backend/</code> directory.
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">
                &quot;Transaction failed&quot;
              </p>
              <p>
                If a transaction fails, the error message usually tells you why.
                Common reasons: you don&apos;t have the required role (ISSUER_ROLE),
                the claim already exists, or the schema is already registered.
              </p>
            </div>
          </div>
        </Step>
      </div>

      <div className="text-center pt-4 pb-8">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Ready to get started?
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/register"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.97]"
          >
            Register Your Identity
          </Link>
          <Link
            to="/passport"
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-all active:scale-[0.97]"
          >
            View Passport
          </Link>
        </div>
      </div>
    </div>
  );
}

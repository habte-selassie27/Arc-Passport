import { useWallet } from "../contexts/WalletContext";
import { WalletButton } from "../components/shared/WalletButton";

export function HomePage() {
  const { isConnected } = useWallet();

  return (
    <div className="max-w-2xl mx-auto text-center py-16 px-4 animate-fade-in">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">ArcPass</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
        Onchain Identity, Attestation & Passport Protocol on Arc L1
      </p>
      <div className="flex justify-center mb-4">
        <WalletButton />
      </div>

      <div className="mb-10 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 text-center max-w-md mx-auto">
        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
          New here? Start here.
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
          Step-by-step guide for complete beginners. No crypto experience needed.
        </p>
        <a
          href="/guide"
          className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.97]"
        >
          Read the Guide
        </a>
      </div>

      <div className="flex justify-center gap-3 mb-10">
        <a
          href="https://faucet.circle.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.97]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.75 5a.75.75 0 00-.75.75v5.5a.75.75 0 001.5 0v-5.5A.75.75 0 009.75 5zm0 10.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
          Faucet (get testnet USDC)
        </a>
      </div>

      {isConnected && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/register"
              className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border border-gray-200 dark:border-gray-700 group"
            >
              <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Register Identity</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Create your onchain identity</p>
            </a>
            <a
              href="/schema"
              className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border border-gray-200 dark:border-gray-700 group"
            >
              <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">Register Schema</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Create new claim schema definitions</p>
            </a>
            <a
              href="/passport"
              className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border border-gray-200 dark:border-gray-700 group"
            >
              <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">View Passport</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">See your credentials</p>
            </a>
            <a
              href="/verify"
              className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border border-gray-200 dark:border-gray-700 group"
            >
              <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Verify</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Check a credential</p>
            </a>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/issue"
              className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border border-gray-200 dark:border-gray-700 group"
            >
              <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Issuer Dashboard</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Issue and revoke attestations</p>
            </a>
            <a
              href="/bridge"
              className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border border-gray-200 dark:border-gray-700 group"
            >
              <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Bridge USDC</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">CCTP v2 cross-chain transfer</p>
            </a>
          </div>
        </>
      )}
    </div>
  );
}

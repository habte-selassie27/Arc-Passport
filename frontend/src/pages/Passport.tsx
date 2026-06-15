import { useParams, useNavigate } from "react-router-dom";
import { usePassport } from "../hooks/usePassport";
import { PassportCard } from "../components/passport/PassportCard";
import { CardSkeleton } from "../components/shared/LoadingSkeleton";
import { PassportErrorBoundary } from "../components/shared/PassportErrorBoundary";
import { useWallet } from "../contexts/WalletContext";
import { API_BASE_URL } from "../config/api";

export function PassportPage() {
  const { address: paramAddress } = useParams<{ address: string }>();
  const { address: connectedAddress } = useWallet();
  const navigate = useNavigate();
  const targetAddress = (paramAddress || connectedAddress) as `0x${string}` | undefined;
  const { data: passport, isLoading, error, refetch } = usePassport(targetAddress);

  if (!targetAddress) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <p className="text-gray-600 dark:text-gray-400 mb-4">Connect your wallet or provide an address to view a passport.</p>
        <div className="flex justify-center">
          <input
            type="text"
            placeholder="0x... enter an address"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLInputElement).value.startsWith("0x")) {
                navigate(`/passport/${(e.target as HTMLInputElement).value}`);
              }
            }}
            className="w-80 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
        Passport for {targetAddress.slice(0, 6)}...{targetAddress.slice(-4)}
      </h1>
      <PassportErrorBoundary>
        {isLoading && <CardSkeleton />}

        {error && (
          <div className="text-center max-w-md mx-auto">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <p className="text-red-700 dark:text-red-300 font-medium mb-2">Could not load passport</p>
              <p className="text-xs text-red-600 dark:text-red-400 mb-4 font-mono break-all">
                {(error as Error).message}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                The passport API at <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">{API_BASE_URL}</code> may be offline.
                Start the backend with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">npm run dev</code> in the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">backend/</code> directory.
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {passport && <PassportCard passport={passport} />}
      </PassportErrorBoundary>
    </div>
  );
}

import { useEffect } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useIssuerCheck } from "../hooks/useIssuerCheck";
import { AttestForm } from "../components/forms/AttestForm";
import { RevokeForm } from "../components/forms/RevokeForm";
import { LoadingSkeleton } from "../components/shared/LoadingSkeleton";

export function IssuerPage() {
  const { isConnected, address } = useWallet();
  const { isIssuer, isLoading, error, check } = useIssuerCheck(address);

  useEffect(() => {
    if (address) check();
  }, [address, check]);

  if (!isConnected) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <p className="text-gray-600 dark:text-gray-400">Connect your wallet to access the issuer dashboard.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 animate-fade-in">
        <p className="text-gray-500 dark:text-gray-400 text-center mb-3">
          Sign the message in your wallet to verify issuer permissions...
        </p>
        <LoadingSkeleton lines={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Verification Failed</h2>
          <p className="text-sm text-red-700 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={check}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isIssuer === false) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Access Denied</h2>
          <p className="text-sm text-red-700 dark:text-red-400">
            Your wallet does not hold ISSUER_ROLE on the AttestationRegistry contract.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 space-y-12 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Issuer Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 font-mono">{address}</p>
        <div
          role="alert"
          className="max-w-2xl mx-auto mb-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-xs text-yellow-800 dark:text-yellow-300"
        >
          <strong>ArcPass never asks you to approve token spending.</strong> If your wallet
          shows a token approval request (USDC <code>approve</code> or <code>setApprovalForAll</code>)
          on this site, reject it immediately and report it.
        </div>
        <AttestForm />
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 pt-12">
        <RevokeForm />
      </div>
    </div>
  );
}

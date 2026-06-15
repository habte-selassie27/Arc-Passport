import { useWallet } from "../../contexts/WalletContext";

const ARC_TESTNET = {
  chainId: "0x4CEA72",
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

async function addArcChain() {
  try {
    const w = window as unknown as Record<string, unknown>;
    const provider = w.ethereum;
    if (provider && typeof provider === "object" && "request" in provider) {
      await (provider as { request: (args: { method: string; params: unknown[] }) => Promise<unknown> }).request({
        method: "wallet_addEthereumChain",
        params: [ARC_TESTNET],
      });
    }
  } catch (e) {
    console.warn("Failed to add Arc chain:", e);
  }
}

export function WalletButton() {
  const { address, isConnected, connect, disconnect } = useWallet();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => { navigator.clipboard.writeText(address); }}
          className="text-sm text-gray-600 dark:text-gray-400 font-mono hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          title="Click to copy full address"
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
        <button
          onClick={disconnect}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={addArcChain}
        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded transition-colors border border-gray-200 dark:border-gray-700"
        title="Add Arc Testnet to your wallet"
      >
        + Arc
      </button>
      <button
        onClick={connect}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] text-white rounded transition-all text-sm font-medium shadow-sm hover:shadow-blue-500/20"
      >
        Connect Wallet
      </button>
    </div>
  );
}

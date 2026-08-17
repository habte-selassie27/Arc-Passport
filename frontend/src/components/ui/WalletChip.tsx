import { useWallet } from "../../contexts/WalletContext";
import { Button } from "./Button";

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

export function WalletChip() {
  const { address, isConnected, connect, disconnect } = useWallet();

  if (isConnected && address) {
    return (
      <div className="wallet-chip">
        <span className="dot dot--on" aria-hidden="true" title="Connected" />
        <button
          type="button"
          className="wallet-chip__addr"
          onClick={() => {
            void navigator.clipboard.writeText(address);
          }}
          title="Click to copy full address"
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
        <button type="button" className="wallet-chip__disconnect" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void addArcChain()}
        className="btn btn--ghost btn--sm"
        title="Add Arc Testnet to your wallet"
      >
        + Arc
      </button>
      <Button onClick={connect}>Connect Wallet</Button>
    </div>
  );
}

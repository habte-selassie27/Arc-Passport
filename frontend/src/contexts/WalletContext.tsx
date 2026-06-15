import { createContext, useContext, type ReactNode } from "react";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";

interface WalletContextType {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  chainId: number | undefined;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  };

  return (
    <WalletContext.Provider value={{ address, isConnected, chainId, connect: handleConnect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

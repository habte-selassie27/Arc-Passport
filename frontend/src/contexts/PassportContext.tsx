import { createContext, useContext, type ReactNode } from "react";
import { usePassport } from "../hooks/usePassport";
import { useWallet } from "./WalletContext";
import type { PassportDocument } from "../types/passport";

interface PassportContextType {
  passport: PassportDocument | null | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const PassportContext = createContext<PassportContextType | null>(null);

export function PassportProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const { data: passport, isLoading, error, refetch } = usePassport(address);

  return (
    <PassportContext.Provider value={{ passport, isLoading, error, refetch }}>
      {children}
    </PassportContext.Provider>
  );
}

export function usePassportContext() {
  const ctx = useContext(PassportContext);
  if (!ctx) throw new Error("usePassportContext must be used within PassportProvider");
  return ctx;
}

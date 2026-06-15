import { useState, useCallback } from "react";
import { useSignMessage } from "wagmi";
import { apiUrl } from "../config/api";

export function useIssuerCheck(address: string | undefined) {
  const { signMessageAsync } = useSignMessage();
  const [isIssuer, setIsIssuer] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    setIsIssuer(null);
    try {
      const nonce = crypto.randomUUID();
      const message = `ArcPass:/issuer/check:${nonce}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch(apiUrl("/issuer/check"), {
        headers: {
          "x-wallet-address": address,
          "x-nonce": nonce,
          "x-signature": signature,
        },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Check failed");
      setIsIssuer(json.data.isIssuer === true);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      setError(msg);
      setIsIssuer(false);
    } finally {
      setIsLoading(false);
    }
  }, [address, signMessageAsync]);

  return { isIssuer, isLoading, error, check };
}

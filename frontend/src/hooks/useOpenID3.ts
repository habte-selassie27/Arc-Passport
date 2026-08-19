import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { apiUrl } from "../config/api";
import { signedFetch } from "../utils/signedApi";

// ── Types ──

export type OpenID3State = "initialized" | "pending" | "linked" | "attesting" | "complete" | "failed" | "expired";

export interface OpenID3Link {
  linkId: string;
  subject: string;
  state: OpenID3State;
  providerId: string;
  providerName: string;
  accountHandle?: string;
  accountId?: string;
  claimId?: string;
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface OpenID3Status {
  subject: string;
  linked: boolean;
  provider?: string;
  accountHandle?: string;
  checkedAt?: number;
  expiresAt?: number;
  isHolder: boolean;
}

export interface OpenID3Config {
  provider: string;
  mechanism: string;
  schemaId: string;
  providers: { id: string; name: string; description: string; icon: string }[];
}

export interface StartResult {
  linkId: string;
  authUrl: string;
}

// ── Public hooks (no auth) ──

export function useOpenID3Status(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["openid3-status", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(apiUrl(`/openid3/verify/${address}`));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load status");
      return json.data as OpenID3Status;
    },
    enabled: !!address,
  });
}

export function useOpenID3Config() {
  return useQuery({
    queryKey: ["openid3-config"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/openid3/config"));
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load config");
      return json.data as OpenID3Config;
    },
  });
}

// ── Authenticated flow hooks ──

export function useOpenID3Flow() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const start = useMutation({
    mutationFn: async (providerId: string) => {
      if (!address) throw new Error("Connect a wallet first");
      return signedFetch<StartResult>({
        path: "/openid3/start",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: { providerId },
      });
    },
  });

  const poll = async (linkId: string): Promise<OpenID3Link> => {
    if (!address) throw new Error("Connect a wallet first");
    return signedFetch<OpenID3Link>({
      path: `/openid3/status/${linkId}`,
      address,
      signMessage: signMessageAsync,
    });
  };

  const complete = useMutation({
    mutationFn: async (args: { code: string; linkId: string }) => {
      if (!address) throw new Error("Connect a wallet first");
      return signedFetch<OpenID3Link>({
        path: "/openid3/callback",
        address,
        signMessage: signMessageAsync,
        method: "POST",
        body: args,
      });
    },
  });

  return { address, start, poll, complete };
}

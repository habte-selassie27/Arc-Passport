import { useCallback, useState } from "react";
import { useSignMessage } from "wagmi";
import { signedFetch } from "../utils/signedApi";

export interface AppNotification {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  data:      Record<string, unknown>;
  read:      boolean;
  createdAt: number;
}

export function useNotifications(address: `0x${string}` | undefined) {
  const { signMessageAsync } = useSignMessage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await signedFetch<{ notifications: AppNotification[] }>({
        path: "/v1/notifications",
        address,
        signMessage: signMessageAsync,
      });
      setNotifications(data.notifications);
      setUnread(data.notifications.filter((n) => !n.read).length);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [address, signMessageAsync]);

  const markRead = useCallback(
    async (id: string) => {
      if (!address) return;
      try {
        await signedFetch({ path: "/v1/notifications/read", address, signMessage: signMessageAsync, method: "POST", body: { id } });
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        setUnread((prev) => Math.max(0, prev - 1));
      } catch (err: unknown) {
        setError((err as Error).message);
      }
    },
    [address, signMessageAsync]
  );

  const markAllRead = useCallback(async () => {
    if (!address) return;
    try {
      await signedFetch({ path: "/v1/notifications/read", address, signMessage: signMessageAsync, method: "POST", body: { all: true } });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }, [address, signMessageAsync]);

  return { notifications, unread, isLoading, error, load, markRead, markAllRead };
}


import { useNotifications } from "../../hooks/useNotifications";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";

/**
 * Notifications card — shows the connected wallet's notifications with an
 * unread badge and mark-read actions. Lightweight UI over the store-backed
 * /v1/notifications API (ATTESTATIONS.md §20).
 */
export function NotificationsCard({ address }: { address: `0x${string}` }) {
  const { notifications, unread, isLoading, error, load, markRead, markAllRead } = useNotifications(address);
  const loaded = notifications.length > 0 || error || isLoading;

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h2 className="display--medium t-lg">
          Notifications
          {unread > 0 && (
            <span className="chip chip--pending" style={{ marginLeft: "var(--space-2)", textTransform: "none", letterSpacing: "0.04em" }}>
              {unread} new
            </span>
          )}
        </h2>
        {loaded && unread > 0 && (
          <button type="button" className="btn btn--link btn--sm" onClick={() => void markAllRead()}>
            Mark all read
          </button>
        )}
      </div>

      {!loaded && (
        <div style={{ padding: "var(--space-5)", textAlign: "center" }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void load()}>
            Load notifications
          </button>
        </div>
      )}

      {isLoading && notifications.length === 0 && (
        <div className="flex items-center justify-center gap-2 c-muted t-sm" style={{ padding: "var(--space-6)" }}>
          <span className="spinner" style={{ width: 12, height: 12 }} aria-hidden="true" />
          Loading notifications…
        </div>
      )}

      {error && !isLoading && notifications.length === 0 && (
        <div style={{ padding: "var(--space-4)" }}>
          <ErrorState
            title="Could not load notifications"
            body={<p className="t-xs c-subtle">{error}</p>}
            onRetry={() => void load()}
          />
        </div>
      )}

      {!isLoading && !error && notifications.length === 0 && loaded && (
        <EmptyState
          title="No notifications yet"
          body="You'll be notified when credentials are issued to your address."
        />
      )}

      {notifications.length > 0 && (
        <div style={{ borderTop: "1px solid var(--color-border)" }}>
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => void markRead(n.id)}
              className="w-full text-left"
              style={{
                padding: "var(--space-3) var(--space-5)",
                opacity: n.read ? 0.6 : 1,
                background: n.read ? "transparent" : "rgba(59,130,246,0.05)",
                border: "none",
                borderBottom: "1px solid rgba(30,45,64,0.5)",
                cursor: "pointer",
                transition: "background-color var(--duration-fast)",
              }}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="t-sm" style={{ fontWeight: 500, color: n.read ? "var(--color-muted)" : "var(--color-on-bright)", display: "block" }}>
                    {n.title}
                  </span>
                  <span className="t-xs c-subtle" style={{ display: "block", marginTop: 2 }}>
                    {n.body}
                  </span>
                </span>
                <span className="t-xs c-subtle" style={{ whiteSpace: "nowrap", marginTop: 2 }}>
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

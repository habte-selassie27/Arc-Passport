/**
 * ScorerPassesGate — Drop-in guard component for conditionally rendering content
 * based on a scorer result.
 *
 * Usage:
 *   <ScorerPassesGate address={userAddress} scorerId={0}>
 *     <GrantClaimButton />
 *   </ScorerPassesGate>
 */

import { useScorerPasses } from "../../hooks/useScorerPasses";

interface ScorerPassesGateProps {
  /** Subject wallet address. */
  address: string;
  /** Scorer ID to check (default: 0 = global ArcPass scorer). */
  scorerId?: number;
  /** Shown when the subject fails the scorer check. */
  fallback?: React.ReactNode;
  /** Shown while loading the scorer result. */
  skeleton?: React.ReactNode;
  /** Content shown when the subject passes. */
  children: React.ReactNode;
}

const DEFAULT_SKELETON = (
  <div
    style={{
      padding: "var(--space-3)",
      borderRadius: "var(--radius-md)",
      background: "var(--color-surface-1)",
      border: "1px solid var(--color-border)",
    }}
  >
    <div className="shimmer" style={{ height: 20, width: 120, borderRadius: "var(--radius-sm)" }} />
  </div>
);

export function ScorerPassesGate({
  address,
  scorerId = 0,
  fallback = null,
  skeleton = DEFAULT_SKELETON,
  children,
}: ScorerPassesGateProps) {
  const { data, isLoading, error } = useScorerPasses(address as `0x${string}`, scorerId);

  if (isLoading) return <>{skeleton}</>;
  if (error) return <>{fallback}</>;
  if (!data?.passes) return <>{fallback}</>;

  return <>{children}</>;
}

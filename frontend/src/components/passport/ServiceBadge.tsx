interface ServiceBadgeProps {
  name: string;
  status?: string;
  activeClaims?: number;
  verified?: boolean;
  claimCount?: number;
}

export function ServiceBadge({
  name,
  status,
  activeClaims,
  verified,
  claimCount,
}: ServiceBadgeProps) {
  const isVerified = verified ?? (status === "ok" && (claimCount ?? activeClaims ?? 0) > 0);
  const count = claimCount ?? activeClaims ?? 0;

  return (
    <span className={`chip ${isVerified ? "chip--configured" : "chip--muted"}`} title={`${name} — ${isVerified ? count : "no valid"} credential${isVerified && count !== 1 ? "s" : ""}`}>
      <span className={`merkle-leaf${isVerified ? "" : " merkle-leaf--off"}`} aria-hidden="true" />
      {name}
      {count > 0 && <span className="c-subtle">({count})</span>}
    </span>
  );
}

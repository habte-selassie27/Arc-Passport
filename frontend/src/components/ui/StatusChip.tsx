export type ClaimStatus = "VALID" | "REVOKED" | "PENDING" | "EXPIRED" | "UNVERIFIED";

interface StatusChipProps {
  status: ClaimStatus;
  /** Show a filled dot indicator alongside the label. */
  dot?: boolean;
}

const STATUS_CLASS: Record<ClaimStatus, string> = {
  VALID:      "chip--valid",
  REVOKED:    "chip--revoked",
  PENDING:    "chip--pending",
  EXPIRED:    "chip--expired",
  UNVERIFIED: "chip--unverified",
};

export function StatusChip({ status, dot = true }: StatusChipProps) {
  const dotOn = status === "VALID";
  return (
    <span className={`chip ${STATUS_CLASS[status]}`}>
      {dot && <span className={`dot ${dotOn ? "dot--on" : "dot--off"}`} aria-hidden="true" />}
      {status}
    </span>
  );
}

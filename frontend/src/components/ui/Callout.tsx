import type { ReactNode } from "react";

type CalloutType = "info" | "warn" | "tip";

interface CalloutProps {
  type?: CalloutType;
  children: ReactNode;
}

const LABEL: Record<CalloutType, string> = {
  info: "ℹ Info",
  warn: "⚠ Warning",
  tip: "✓ Tip",
};

export function Callout({ type = "info", children }: CalloutProps) {
  const classes = ["callout", type === "warn" && "callout--warn", type === "tip" && "callout--tip"].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <span className="callout__type">{LABEL[type]}</span>
      <div>{children}</div>
    </div>
  );
}

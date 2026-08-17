import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Green glow — confirmed on-chain valid states ONLY. */
  verified?: boolean;
  /** Red border — revoked / invalid. */
  revoked?: boolean;
  interactive?: boolean;
}

export function Card({ verified = false, revoked = false, interactive = false, className = "", ...rest }: CardProps) {
  const classes = [
    "card",
    verified && "card--verified",
    revoked && "card--revoked",
    interactive && "card--interactive",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes} {...rest} />;
}

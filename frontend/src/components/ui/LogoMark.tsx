interface LogoMarkProps {
  size?: number;
  className?: string;
}

/** The ArcPass mark — a square rotated 45° with an inner node, the
 *  "attestation node" metaphor. Arc blue. */
export function LogoMark({ size = 20, className = "" }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="12"
        y="2.6"
        width="13.3"
        height="13.3"
        rx="2.5"
        transform="rotate(45 12 2.6)"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="rgba(59,130,246,0.12)"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

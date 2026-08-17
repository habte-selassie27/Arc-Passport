interface AddressDisplayProps {
  address: string;
  truncate?: boolean;
  className?: string;
  /** Show full address with a subtle 0x prefix and bright hex body. */
  full?: boolean;
}

function CopyIcon() {
  return (
    <svg
      className="addr__copy"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function AddressDisplay({ address, truncate = true, className = "", full = false }: AddressDisplayProps) {
  const display = truncate && !full ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
  const classes = ["addr", full && "addr--full", className].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={() => {
        void navigator.clipboard.writeText(address);
      }}
      aria-label="wallet address"
      title={`${address} — click to copy`}
    >
      {full ? (
        <>
          <span className="addr__prefix">{address.slice(0, 2)}</span>
          <span className="addr__hex">{address.slice(2)}</span>
        </>
      ) : (
        display
      )}
      <CopyIcon />
    </button>
  );
}

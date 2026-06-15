interface AddressDisplayProps {
  address: string;
  truncate?: boolean;
  className?: string;
}

export function AddressDisplay({ address, truncate = true, className = "" }: AddressDisplayProps) {
  const display = truncate ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(address); }}
      className={`font-mono text-sm text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-left ${className}`}
      title="Click to copy full address"
    >
      {display}
    </button>
  );
}

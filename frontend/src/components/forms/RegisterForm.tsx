import { useState, useCallback, useRef } from "react";
import { ADDRESSES } from "../../config/addresses";
import { TxStatus } from "../shared/TxStatus";
import { TransactionPreview } from "../shared/TransactionPreview";
import { GasEstimate } from "../shared/GasEstimate";
import { useIdentityRegister } from "../../hooks/useIdentity";
import { toast } from "../shared/Toast";

const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export function RegisterForm() {
  const [name, setName] = useState("");
  const [metadataURI, setMetadataURI] = useState("ipfs://bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  const { writeContract, data: hash, isPending, error } = useIdentityRegister();

  const registerArgs: readonly unknown[] = [metadataURI] as const;
  const simEnabled = !!metadataURI && !!ADDRESSES.identityRegistry;

  const simRequestRef = useRef<unknown | null>(null);

  const handleSimResult = useCallback((result: { request: unknown | null; error: string | null }) => {
    simRequestRef.current = result.request;
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!simRequestRef.current) {
      toast("error", "Transaction simulation did not succeed. Check the metadata URI.");
      return;
    }
    // Pass the simulated request directly — this ensures the exact same calldata
    // the user reviewed is what gets signed (§15.6.1).
    const req = simRequestRef.current as { request: { address: `0x${string}`; data: `0x${string}` } };
    writeContract({
      address: ADDRESSES.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "register",
      args: [metadataURI],
    });
  }, [writeContract, metadataURI]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
          placeholder="Your name"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metadata URI (IPFS)</label>
        <input
          type="text"
          value={metadataURI}
          onChange={(e) => setMetadataURI(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
          placeholder="ipfs://bafkrei..."
          required
        />
      </div>

      <TransactionPreview
        enabled={simEnabled}
        address={ADDRESSES.identityRegistry}
        abi={IDENTITY_REGISTRY_ABI}
        functionName="register"
        args={registerArgs}
        label="Identity Registration"
        onSimResult={handleSimResult}
      />

      <GasEstimate
        enabled={simEnabled}
        address={ADDRESSES.identityRegistry}
        abi={IDENTITY_REGISTRY_ABI}
        functionName="register"
        args={registerArgs}
      />

      <button
        type="submit"
        disabled={isPending || !simEnabled}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-[0.98] font-medium"
      >
        {isPending ? "Registering..." : "Register Identity"}
      </button>

      <TxStatus hash={hash} />
      {error && <p className="text-red-600 dark:text-red-400 text-sm text-center">{(error as Error).message}</p>}
    </form>
  );
}

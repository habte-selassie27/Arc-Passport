import { useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ADDRESSES } from "../config/addresses";
import { TOKEN_MESSENGER_ABI } from "../abis/TokenMessenger";
import { TxStatus } from "../components/shared/TxStatus";
import { TransactionPreview } from "../components/shared/TransactionPreview";
import { GasEstimate } from "../components/shared/GasEstimate";
import { parseContractError } from "../utils/parseContractError";
import { toast } from "../components/shared/Toast";
import { parseUnits } from "viem";

export function BridgePage() {
  const [amount, setAmount] = useState("");
  const [destinationDomain, setDestinationDomain] = useState("0");
  const [recipient, setRecipient] = useState("");

  const domain = Number(destinationDomain);
  const amountBn = amount ? parseUnits(amount, 6) : 0n;
  const recipientBytes = (recipient.startsWith("0x") ? recipient.padEnd(66, "0") : `0x${recipient.padEnd(64, "0")}`) as `0x${string}`;
  const simEnabled = !!ADDRESSES.usdcErc20 && !!ADDRESSES.tokenMessengerV2 && amountBn > 0n && !!recipient;

  const { data: tokenMessengerCode, isLoading: checkingContract } = useReadContract({
    address: ADDRESSES.tokenMessengerV2,
    abi: [{ type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" }],
    functionName: "owner",
    query: { enabled: !!ADDRESSES.tokenMessengerV2 },
  });

  const { writeContract: doDeposit, data: hash, isPending, error } = useWriteContract({
    mutation: {
      onError: (err) => toast("error", parseContractError(err)),
      onSuccess: () => toast("success", "Bridge initiated"),
    },
  });

  const destinationToken = ADDRESSES.usdcErc20;
  const contractReady = !!ADDRESSES.tokenMessengerV2 && !!tokenMessengerCode;
  const bridgeArgs = [amountBn, domain, recipientBytes, destinationToken] as const;

  const handleBridge = () => {
    if (!ADDRESSES.tokenMessengerV2) {
      toast("error", "TokenMessengerV2 not configured");
      return;
    }
    if (!recipient) {
      toast("error", "Recipient address required");
      return;
    }
    doDeposit({
      address: ADDRESSES.tokenMessengerV2,
      abi: TOKEN_MESSENGER_ABI,
      functionName: "depositForBurn",
      args: bridgeArgs,
    });
  };

  return (
    <div className="max-w-lg mx-auto py-12 px-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Bridge USDC</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
        Burn USDC on Arc to mint on another chain via CCTP v2
      </p>

      {checkingContract ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700 text-xs text-center text-gray-500">
          Checking contract availability...
        </div>
      ) : !contractReady ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 text-xs">
          <p className="text-yellow-800 dark:text-yellow-300 font-medium mb-1">TokenMessenger not reachable</p>
          <p className="text-yellow-700 dark:text-yellow-400">
            The CCTP contract at <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">{ADDRESSES.tokenMessengerV2 || "not configured"}</code> is not responding. Check that the address is correct and you&apos;re on the right network.
          </p>
        </div>
      ) : (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-6 text-xs">
          <p className="text-green-700 dark:text-green-300">
            TokenMessenger ready at <code className="bg-green-100 dark:bg-green-900/40 px-1 rounded">{ADDRESSES.tokenMessengerV2}</code>
          </p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700 text-xs">
        <p className="text-gray-500 dark:text-gray-400 mb-1">
          <span className="font-medium text-gray-700 dark:text-gray-300">TokenMessenger:</span> {ADDRESSES.tokenMessengerV2}
        </p>
        <p className="text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">MessageTransmitter:</span> {ADDRESSES.msgTransmitterV2}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (USDC)</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
            placeholder="100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination Domain</label>
          <select
            value={destinationDomain}
            onChange={(e) => setDestinationDomain(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
          >
            <option value="0">Ethereum</option>
            <option value="1">Avalanche</option>
            <option value="2">Polygon PoS</option>
            <option value="3">Arbitrum</option>
            <option value="4">Base</option>
            <option value="5">Solana</option>
            <option value="6">Noble</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mint Recipient (address)</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
            placeholder="0x..."
          />
        </div>

        <TransactionPreview
          enabled={simEnabled && contractReady}
          address={ADDRESSES.tokenMessengerV2}
          abi={TOKEN_MESSENGER_ABI}
          functionName="depositForBurn"
          args={bridgeArgs}
          label="Bridge USDC"
        />

        <GasEstimate
          enabled={simEnabled && contractReady}
          address={ADDRESSES.tokenMessengerV2}
          abi={TOKEN_MESSENGER_ABI}
          functionName="depositForBurn"
          args={bridgeArgs}
        />

        <button
          onClick={handleBridge}
          disabled={isPending || !simEnabled || !contractReady}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-[0.98] font-medium"
        >
          {isPending ? "Bridging..." : `Bridge ${amount || "0"} USDC`}
        </button>

        <TxStatus hash={hash} />
        {error && <p className="text-red-600 dark:text-red-400 text-sm text-center">{parseContractError(error)}</p>}
      </div>
    </div>
  );
}

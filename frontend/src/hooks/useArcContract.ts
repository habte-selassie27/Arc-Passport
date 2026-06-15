import {
  useReadContract,
  useSimulateContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { ADDRESSES } from "../config/addresses";
import { parseContractError } from "../utils/parseContractError";

const ATTESTATION_ABI = [
  {
    type: "function",
    name: "attest",
    inputs: [
      { name: "subject", type: "address" },
      { name: "schemaId", type: "bytes32" },
      { name: "dataCommitment", type: "bytes32" },
      { name: "expiresAt", type: "uint256" },
    ],
    outputs: [{ name: "claimId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revoke",
    inputs: [{ name: "claimId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isValid",
    inputs: [{ name: "claimId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getActiveClaim",
    inputs: [
      { name: "subject", type: "address" },
      { name: "schemaId", type: "bytes32" },
      { name: "issuer", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
] as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

export function useValidateClaim(claimId: `0x${string}` | undefined) {
  return useReadContract({
    address: ADDRESSES.attestationRegistry,
    abi: ATTESTATION_ABI,
    functionName: "isValid",
    args: claimId ? [claimId] : undefined,
    query: { enabled: !!ADDRESSES.attestationRegistry && !!claimId },
  });
}

export interface AttestArgs {
  subject: `0x${string}`;
  schemaId: `0x${string}`;
  dataCommitment: `0x${string}`;
  expiresAt: bigint;
}

export interface RevokeArgs {
  claimId: `0x${string}`;
}

export interface WriteHookResult<TArgs> {
  /** Pre-flight simulation. Reverts are surfaced here BEFORE the user signs. */
  sim: ReturnType<typeof useSimulateContract>;
  /** True when the simulation succeeded and a write request is ready. */
  canWrite: boolean;
  /** Human-readable error from the simulation (revert reason decoded). */
  simErrorMessage: string | null;
  /** Execute the transaction. Must only be called when canWrite is true. */
  write: () => void;
  hash: `0x${string}` | undefined;
  isPending: boolean;
  isSuccess: boolean;
  error: Error | null;
  args: TArgs | null;
}

/**
 * Pre-flight + write for attest(). Per AGENTS.md §15.6.1, every write contract
 * call MUST be simulated first via useSimulateContract to catch reverts and
 * surface the decoded function call to the user before they sign.
 *
 * The simulation request is consumed by useWriteContract's request argument —
 * wagmi's recommended pattern. If the simulation fails (revert, missing role,
 * bad params), the `simErrorMessage` is exposed to the caller for UI display,
 * preventing blind-signing of a malicious or buggy call.
 */
export function useAttestWrite(args: AttestArgs | null): WriteHookResult<AttestArgs> {
  const enabled =
    !!args &&
    !!ADDRESSES.attestationRegistry &&
    args.subject !== ZERO_ADDRESS &&
    args.schemaId !== ZERO_BYTES32;

  const sim = useSimulateContract({
    address: ADDRESSES.attestationRegistry!,
    abi: ATTESTATION_ABI,
    functionName: "attest",
    args: enabled
      ? [args!.subject, args!.schemaId, args!.dataCommitment, args!.expiresAt]
      : undefined,
    query: { enabled },
  });

  const simErrorMessage = sim.error ? parseContractError(sim.error) : null;

  const {
    data: hash,
    isPending,
    error: writeError,
    writeContract,
  } = useWriteContract({
    mutation: {
      onError: (err) => parseContractError(err),
    },
  });
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const canWrite = !!sim.data?.request;
  const write = () => {
    if (sim.data?.request) writeContract(sim.data.request);
  };

  return {
    sim,
    canWrite,
    simErrorMessage,
    write,
    hash,
    isPending: isPending || isLoading,
    isSuccess,
    error: (writeError as Error | null) ?? null,
    args,
  };
}

/**
 * Pre-flight + write for revoke(). See useAttestWrite for design rationale.
 */
export function useRevokeWrite(args: RevokeArgs | null): WriteHookResult<RevokeArgs> {
  const enabled = !!args && !!ADDRESSES.attestationRegistry;

  const sim = useSimulateContract({
    address: ADDRESSES.attestationRegistry!,
    abi: ATTESTATION_ABI,
    functionName: "revoke",
    args: enabled ? [args!.claimId] : undefined,
    query: { enabled },
  });

  const simErrorMessage = sim.error ? parseContractError(sim.error) : null;

  const {
    data: hash,
    isPending,
    error: writeError,
    writeContract,
  } = useWriteContract({
    mutation: {
      onError: (err) => parseContractError(err),
    },
  });
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const canWrite = !!sim.data?.request;
  const write = () => {
    if (sim.data?.request) writeContract(sim.data.request);
  };

  return {
    sim,
    canWrite,
    simErrorMessage,
    write,
    hash,
    isPending: isPending || isLoading,
    isSuccess,
    error: (writeError as Error | null) ?? null,
    args,
  };
}

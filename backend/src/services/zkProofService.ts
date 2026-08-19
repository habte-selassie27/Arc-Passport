/**
 * zkProofService.ts — ZK proof validation and attestation issuance.
 *
 * What it does: validates ZK proofs via the on-chain ZKVerifier contract,
 *   then issues ArcPass attestations through ZKPassportAdapter.
 * What it does NOT do: generate ZK proofs (that happens on the user's device).
 * What calls it: routes/zk.ts
 */

import { keccak256 } from "viem";
import { getCircleClient, assertBlockchain } from "../config/circle.js";
import { publicClient } from "../services/arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { Errors } from "../utils/errors.js";

// ── ABIs ──────────────────────────────────────────────────────────────────

const ZK_VERIFIER_ABI = [
  {
    type: "function",
    name: "addVerifier",
    inputs: [
      { name: "backend", type: "address" },
      { name: "name", type: "string" },
    ],
    outputs: [{ name: "", type: "uint16" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verifyProof",
    inputs: [
      { name: "verifierId", type: "uint16" },
      { name: "proof", type: "bytes" },
      { name: "publicInputs", type: "uint256[]" },
      { name: "subject", type: "address" },
      { name: "proofHash", type: "bytes32" },
    ],
    outputs: [{ name: "valid", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isProofUsed",
    inputs: [{ name: "proofHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getActiveVerifierIds",
    inputs: [],
    outputs: [{ name: "", type: "uint16[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalProofsVerified",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifiers",
    inputs: [{ name: "verifierId", type: "uint16" }],
    outputs: [
      { name: "backend", type: "address" },
      { name: "name", type: "string" },
      { name: "addedAt", type: "uint64" },
      { name: "active", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

const ZK_PASSPORT_ADAPTER_ABI = [
  {
    type: "function",
    name: "submitProof",
    inputs: [
      { name: "verifierId", type: "uint16" },
      { name: "proof", type: "bytes" },
      { name: "publicInputs", type: "uint256[]" },
      { name: "proofHash", type: "bytes32" },
      { name: "documentType", type: "string" },
      { name: "issuedAt", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
    ],
    outputs: [{ name: "claimId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "submitAttributeProof",
    inputs: [
      { name: "verifierId", type: "uint16" },
      { name: "proof", type: "bytes" },
      { name: "publicInputs", type: "uint256[]" },
      { name: "proofHash", type: "bytes32" },
      { name: "attributeHash", type: "bytes32" },
      { name: "expiresAt", type: "uint256" },
    ],
    outputs: [{ name: "claimId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "trustedDocumentTypes",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────

export interface ZKVerifierInfo {
  id: number;
  backend: string;
  name: string;
  addedAt: number;
  active: boolean;
}

export interface ZKProofSubmission {
  verifierId: number;
  proof: string;
  publicInputs: (number | bigint)[];
  proofHash: string;
  documentType: string;
  issuedAt: number;
  expiresAt: number;
}

export interface ZKAttributeSubmission {
  verifierId: number;
  proof: string;
  publicInputs: (number | bigint)[];
  proofHash: string;
  attributeHash: string;
  expiresAt: number;
}

// ── Service ───────────────────────────────────────────────────────────────

export class ZKProofService {
  private get zkVerifierAddress(): `0x${string}` {
    const addr = ADDRESSES.zkVerifier;
    if (!addr) throw Errors.ChainMismatch("ZK_VERIFIER_ADDRESS", "not configured");
    return addr;
  }

  private get zkAdapterAddress(): `0x${string}` {
    const addr = ADDRESSES.zkPassportAdapter;
    if (!addr) throw Errors.ChainMismatch("ZK_PASSPORT_ADAPTER_ADDRESS", "not configured");
    return addr;
  }

  /**
   * Get all registered ZK verifiers.
   */
  async getVerifiers(): Promise<ZKVerifierInfo[]> {
    const ids = (await publicClient.readContract({
      address: this.zkVerifierAddress,
      abi: ZK_VERIFIER_ABI,
      functionName: "getActiveVerifierIds",
    })) as readonly (number | bigint)[];

    const verifiers: ZKVerifierInfo[] = [];
    for (const id of ids) {
      const info = await publicClient.readContract({
        address: this.zkVerifierAddress,
        abi: ZK_VERIFIER_ABI,
        functionName: "verifiers",
        args: [Number(id)],
      });
      verifiers.push({
        id: Number(id),
        backend: info[0] as string,
        name: info[1] as string,
        addedAt: Number(info[2]),
        active: info[3] as boolean,
      });
    }
    return verifiers;
  }

  /**
   * Check if a proof hash has been used (replay protection).
   */
  async isProofUsed(proofHash: `0x${string}`): Promise<boolean> {
    return publicClient.readContract({
      address: this.zkVerifierAddress,
      abi: ZK_VERIFIER_ABI,
      functionName: "isProofUsed",
      args: [proofHash],
    }) as Promise<boolean>;
  }

  /**
   * Get total proofs verified on-chain.
   */
  async getTotalProofsVerified(): Promise<number> {
    const total = await publicClient.readContract({
      address: this.zkVerifierAddress,
      abi: ZK_VERIFIER_ABI,
      functionName: "totalProofsVerified",
    });
    return Number(total);
  }

  /**
   * Check if a document type is trusted by the adapter.
   */
  async isDocumentTypeTrusted(documentType: string): Promise<boolean> {
    return publicClient.readContract({
      address: this.zkAdapterAddress,
      abi: ZK_PASSPORT_ADAPTER_ABI,
      functionName: "trustedDocumentTypes",
      args: [documentType],
    }) as Promise<boolean>;
  }

  /**
   * Submit a Layer 1 passport authenticity proof via the backend + Circle SDK.
   */
  async submitPassportProof(
    submission: ZKProofSubmission,
    walletId: string
  ): Promise<{ txHash: `0x${string}`; claimId: `0x${string}` }> {
    this._assertBlockchain();

    const txId = await this._submitToCircle(
      "submitProof(uint16,bytes,uint256[],bytes32,string,uint256,uint256)",
      [
        submission.verifierId.toString(),
        submission.proof,
        submission.publicInputs.map(String),
        submission.proofHash,
        submission.documentType,
        submission.issuedAt.toString(),
        submission.expiresAt.toString(),
      ],
      this.zkAdapterAddress,
      walletId
    );

    const txHash = await this._pollForHash(txId);

    // Read the claim ID from events (or compute from tx)
    // For now, return the txHash — the frontend can look up the claim via the indexer
    return { txHash, claimId: ("0x" + "0".repeat(64)) as `0x${string}` };
  }

  /**
   * Submit a Layer 2 ZK attribute proof via the backend + Circle SDK.
   */
  async submitAttributeProof(
    submission: ZKAttributeSubmission,
    walletId: string
  ): Promise<{ txHash: `0x${string}`; claimId: `0x${string}` }> {
    this._assertBlockchain();

    const txId = await this._submitToCircle(
      "submitAttributeProof(uint16,bytes,uint256[],bytes32,bytes32,uint256)",
      [
        submission.verifierId.toString(),
        submission.proof,
        submission.publicInputs.map(String),
        submission.proofHash,
        submission.attributeHash,
        submission.expiresAt.toString(),
      ],
      this.zkAdapterAddress,
      walletId
    );

    const txHash = await this._pollForHash(txId);
    return { txHash, claimId: ("0x" + "0".repeat(64)) as `0x${string}` };
  }

  /**
   * Compute a proof hash (nullifier) from proof bytes and subject.
   */
  computeProofHash(proof: `0x${string}`, subject: `0x${string}`): `0x${string}` {
    return keccak256(
      `0x${Buffer.from(proof.slice(2), "hex").toString("hex")}${subject.slice(2)}` as `0x${string}`
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private _assertBlockchain() {
    const expected = process.env.ARC_BLOCKCHAIN_ENV;
    if (!expected || !["ARC-TESTNET", "ARC-MAINNET"].includes(expected)) {
      throw Errors.ChainMismatch("ARC-TESTNET or ARC-MAINNET", expected ?? "undefined");
    }
  }

  private async _submitToCircle(
    abiFn: string,
    params: unknown[],
    contractAddress: `0x${string}`,
    walletId: string
  ): Promise<string> {
    assertBlockchain(
      process.env.ARC_BLOCKCHAIN_ENV === "ARC-MAINNET" ? "ARC-MAINNET" : "ARC-TESTNET"
    );
    const circleClient = getCircleClient();
    const tx = await circleClient
      .createContractExecutionTransaction({
        walletId,
        blockchain: (process.env.ARC_BLOCKCHAIN_ENV || "ARC-TESTNET") as "ARC-TESTNET",
        contractAddress,
        abiFunctionSignature: abiFn,
        abiParameters: params as string[],
        fee: { type: "level", config: { feeLevel: "MEDIUM" } },
      } as any)
      .catch((err: any) => {
        console.error(`[Circle] ${abiFn} failed:`, err.response?.data || err.message);
        throw err;
      });
    const txId = tx.data?.id;
    if (!txId) throw Errors.TransactionFailed(abiFn, "No transaction ID returned");
    return txId;
  }

  private async _pollForHash(txId: string): Promise<`0x${string}`> {
    const circleClient = getCircleClient();
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      const { data } = await circleClient.getTransaction({ id: txId });
      const state = data?.transaction?.state;
      if (state === "COMPLETE") return data!.transaction!.txHash as `0x${string}`;
      if (state === "FAILED") throw Errors.TransactionFailed("pollForHash", `tx ${txId} FAILED`);
    }
    throw Errors.TransactionFailed("pollForHash", `tx ${txId} timed out after 18s`);
  }
}

export const zkProofService = new ZKProofService();

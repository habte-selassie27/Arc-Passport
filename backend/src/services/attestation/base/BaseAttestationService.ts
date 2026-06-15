import { decodeEventLog, encodeAbiParameters, parseAbiParameters } from "viem";
import { getCircleClient, assertBlockchain } from "../../../config/circle.js";
import { publicClient } from "../../arcService.js";
import { ADDRESSES } from "../../../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../../../abis/AttestationRegistry.js";
import { Errors } from "../../../utils/errors.js";

export interface AttestInput {
  subject: `0x${string}`;
  schemaId: `0x${string}`;
  data: `0x${string}`;
  expiresAt: number;
}

export interface BatchItemResult {
  index:   number;
  success: boolean;
  txHash?: `0x${string}`;
  error?:  string;
  message?: string;
}

export abstract class BaseAttestationService {
  protected readonly serviceName: string;
  protected readonly walletId: string;

  constructor(serviceName: string, walletId: string) {
    this.serviceName = serviceName;
    this.walletId = walletId;
  }

  async issue(input: AttestInput): Promise<`0x${string}`> {
    this._assertBlockchain();
    this._validateSubject(input.subject);
    if (!input.schemaId || input.schemaId === ("0x" + "0".repeat(64))) {
      throw Errors.InvalidSchemaId(input.schemaId ?? "0x0");
    }

    const txId = await this._submitToCircle(
      "attest(address,bytes32,bytes,uint256)",
      [input.subject, input.schemaId, input.data, input.expiresAt.toString()]
    );
    return this._pollForHash(txId);
  }

  async revoke(claimId: `0x${string}`): Promise<`0x${string}`> {
    this._assertBlockchain();
    await this._assertClaimExists(claimId);

    const txId = await this._submitToCircle(
      "revoke(bytes32)",
      [claimId]
    );
    return this._pollForHash(txId);
  }

  async batchIssue(inputs: AttestInput[]): Promise<{ claimIds: `0x${string}`[]; successes: boolean[] }> {
    if (inputs.length === 0 || inputs.length > 100) {
      throw Errors.InvalidBatchSize(inputs.length);
    }
    this._assertBlockchain();

    const encoded = inputs.map((i) => ({
      subject:        i.subject,
      schemaId:       i.schemaId,
      dataCommitment: i.data,
      expiresAt:      BigInt(i.expiresAt),
    }));
    const encodedJson = JSON.stringify(encoded);
    const txId = await this._submitToCircle(
      "batchAttest((address,bytes32,bytes32,uint256)[])",
      [encodedJson]
    );
    const txHash = await this._pollForHash(txId);
    return this._decodeBatchResult(txHash);
  }

  /**
   * Per-item fallback for bulk uploads.
   * Issues each AttestInput individually with try/catch — one failure does not
   * abort the rest. Returns a row-aligned result array.
   * Use when the caller needs row-level errors (e.g. CSV upload UI).
   */
  async issuePerItem(inputs: AttestInput[]): Promise<BatchItemResult[]> {
    if (inputs.length === 0 || inputs.length > 100) {
      throw Errors.InvalidBatchSize(inputs.length);
    }
    const out: BatchItemResult[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      try {
        this._validateSubject(input.subject);
        if (!input.schemaId || input.schemaId === ("0x" + "0".repeat(64))) {
          throw Errors.InvalidSchemaId(input.schemaId ?? "0x0");
        }
        const txHash = await this.issue(input);
        out.push({ index: i, success: true, txHash });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        out.push({
          index:   i,
          success: false,
          error:   e.code ?? "ISSUE_FAILED",
          message: e.message ?? "Unknown error",
        });
      }
    }
    return out;
  }

  async verify(subject: `0x${string}`, schemaId: `0x${string}`) {
    return publicClient.readContract({
      address:      ADDRESSES.passportVerifier!,
      abi:          ATTESTATION_REGISTRY_ABI as unknown as Parameters<typeof publicClient.readContract>[0]["abi"],
      functionName: "verify" as const,
      args:         [subject, schemaId],
    });
  }

  async getClaims(subject: `0x${string}`, _schemaId: `0x${string}` | null) {
    void _schemaId;
    return publicClient.multicall({
      multicallAddress: "0xcA11bde05977b3631167028862bE2a173976CA11" as `0x${string}`,
      contracts: [{
        address:      ADDRESSES.attestationRegistry!,
        abi:          ATTESTATION_REGISTRY_ABI,
        functionName: "getActiveClaim" as const,
        args:         [subject, "0x" + "0".repeat(64) as `0x${string}`, "0x" + "0".repeat(64) as `0x${string}`],
      }],
    });
  }

  async isValid(claimId: `0x${string}`): Promise<boolean> {
    return publicClient.readContract({
      address:      ADDRESSES.attestationRegistry!,
      abi:          ATTESTATION_REGISTRY_ABI,
      functionName: "isValid",
      args:         [claimId],
    }) as Promise<boolean>;
  }

  private _assertBlockchain() {
    const expected = process.env.ARC_BLOCKCHAIN_ENV;
    if (!expected || !["ARC-TESTNET", "ARC-MAINNET"].includes(expected)) {
      throw Errors.ChainMismatch("ARC-TESTNET or ARC-MAINNET", expected ?? "undefined");
    }
    void expected;
  }

  private _validateSubject(subject: string) {
    if (!subject || subject === "0x0000000000000000000000000000000000000000") {
      throw Errors.InvalidSubject(subject);
    }
  }

  private async _assertClaimExists(claimId: `0x${string}`) {
    try {
      const claim = await publicClient.readContract({
        address:      ADDRESSES.attestationRegistry!,
        abi:          ATTESTATION_REGISTRY_ABI,
        functionName: "getClaim",
        args:         [claimId],
      });
      const cid = (claim as unknown as { claimId: string }).claimId;
      if (!claim || !cid || cid === "0x" + "0".repeat(64)) {
        throw Errors.ClaimNotFound(claimId);
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err as { code?: string }).code) throw err;
      throw Errors.ClaimNotFound(claimId);
    }
  }

  private async _submitToCircle(abiFn: string, params: unknown[]): Promise<string> {
    if (!this.walletId) {
      throw Errors.IssuerNotConfigured(this.serviceName, `CIRCLE_${this.serviceName.toUpperCase()}_ISSUER_WALLET_ID`);
    }
    // Per AGENTS.md §15.4.4: guard at the actual submission path (the Circle SDK
    // no longer takes a `blockchain` field — the wallet itself is bound to one chain).
    // This prevents a misconfigured ARC_BLOCKCHAIN_ENV from silently routing to the
    // wrong network via a wallet that was created on a different environment.
    const env = process.env.ARC_BLOCKCHAIN_ENV;
    assertBlockchain(env === "ARC-MAINNET" ? "ARC-MAINNET" : "ARC-TESTNET");
    const circleClient = getCircleClient();
    const tx = await circleClient.createContractExecutionTransaction({
      walletId:             this.walletId,
      contractAddress:      ADDRESSES.attestationRegistry!,
      abiFunctionSignature: abiFn,
      abiParameters:        params as string[],
      fee:                  { type: "level", config: { feeLevel: "MEDIUM" } },
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
      if (state === "FAILED")   throw Errors.TransactionFailed("pollForHash", `tx ${txId} FAILED`);
    }
    throw Errors.TransactionFailed("pollForHash", `tx ${txId} timed out after 18s`);
  }

  private async _decodeBatchResult(txHash: `0x${string}`) {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const batchLog = receipt.logs.find(
        (l) => l.address.toLowerCase() === (ADDRESSES.attestationRegistry ?? "").toLowerCase()
      );
      if (!batchLog) return { claimIds: [], successes: [] };
      const decoded = decodeEventLog({
        abi:       ATTESTATION_REGISTRY_ABI as unknown as ReturnType<typeof parseAbiParameters> extends never ? never : Parameters<typeof decodeEventLog>[0]["abi"],
        data:      batchLog.data,
        topics:    batchLog.topics,
      });
      return {
        claimIds:  ((decoded as unknown as { args: { claimIds: `0x${string}`[] } }).args.claimIds) ?? [],
        successes: ((decoded as unknown as { args: { successes: boolean[] } }).args.successes) ?? [],
      };
    } catch {
      return { claimIds: [], successes: [] };
    }
  }
}

import { encodeAbiParameters, parseAbiParameters } from "viem";
import { BaseAttestationService, type AttestInput } from "../base/BaseAttestationService.js";
import { REPUTATION_SCHEMAS } from "../../../constants/schemas.js";

export class ReputationAttestationService extends BaseAttestationService {
  constructor() {
    super("reputation", process.env.CIRCLE_REPUTATION_ISSUER_WALLET_ID ?? "");
  }

  async issueScore(
    subject: `0x${string}`,
    score: bigint,
    domain: string,
    dataPoints: number,
    expiresAt: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("uint256 score, string domain, uint32 dataPoints, uint64 updatedAt"),
      [score, domain, dataPoints, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId:  REPUTATION_SCHEMAS.REPUTATION_SCORE.id!,
      data,
      expiresAt,
    } as AttestInput);
  }

  async issuePositiveInteraction(
    subject: `0x${string}`,
    context: string,
    counterparty: `0x${string}`,
    platform: string
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string context, address counterparty, string platform, uint64 occurredAt"),
      [context, counterparty, platform, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId:  REPUTATION_SCHEMAS.POSITIVE_INTERACTION.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }

  async issueDispute(
    subject: `0x${string}`,
    type: string,
    reportedBy: `0x${string}`,
    evidence: string,
    resolvedAt: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string type, address reportedBy, string evidence, uint64 resolvedAt"),
      [type, reportedBy, evidence, BigInt(resolvedAt)]
    );
    return this.issue({
      subject,
      schemaId:  REPUTATION_SCHEMAS.DISPUTE_RECORD.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }
}

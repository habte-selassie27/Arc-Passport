import { encodeAbiParameters, parseAbiParameters } from "viem";
import { BaseAttestationService, type AttestInput } from "../base/BaseAttestationService.js";
import { EMPLOYMENT_SCHEMAS } from "../../../constants/schemas.js";

export class EmploymentAttestationService extends BaseAttestationService {
  constructor() {
    super("employment", process.env.CIRCLE_EMPLOYMENT_ISSUER_WALLET_ID ?? "");
  }

  async issueEmployment(
    subject: `0x${string}`,
    employer: string,
    role: string,
    startDate: number,
    endDate: number,
    employerDid: string
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string employer, string role, uint64 startDate, uint64 endDate, string employerDid"),
      [employer, role, BigInt(startDate), BigInt(endDate), employerDid]
    );
    return this.issue({
      subject,
      schemaId:  EMPLOYMENT_SCHEMAS.EMPLOYMENT_RECORD.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }

  async issueIncomeBand(
    subject: `0x${string}`,
    currency: string,
    bandMin: bigint,
    bandMax: bigint,
    provider: string,
    expiresAt: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string currency, uint256 bandMin, uint256 bandMax, uint64 verifiedAt, string provider"),
      [currency, bandMin, bandMax, BigInt(Math.floor(Date.now() / 1000)), provider]
    );
    return this.issue({
      subject,
      schemaId:  EMPLOYMENT_SCHEMAS.INCOME_BAND.id!,
      data,
      expiresAt,
    } as AttestInput);
  }

  async issueContractor(
    subject: `0x${string}`,
    platform: string,
    completedJobs: number,
    totalEarned: bigint,
    rating: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string platform, uint32 completedJobs, uint256 totalEarned, uint16 rating, uint64 updatedAt"),
      [platform, completedJobs, totalEarned, rating, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId:  EMPLOYMENT_SCHEMAS.CONTRACTOR_RECORD.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }
}

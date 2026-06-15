import { encodeAbiParameters, parseAbiParameters } from "viem";
import { BaseAttestationService, type AttestInput } from "../base/BaseAttestationService.js";
import { KYC_SCHEMAS } from "../../../constants/schemas.js";

export class KycAttestationService extends BaseAttestationService {
  constructor() {
    super("kyc", process.env.CIRCLE_KYC_ISSUER_WALLET_ID ?? "");
  }

  async issueBasicKyc(
    subject: `0x${string}`,
    level: number,
    country: string,
    provider: string,
    expiresAt: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("uint8 level, string country, string provider, uint64 checkedAt"),
      [level, country, provider, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId: KYC_SCHEMAS.KYC_BASIC.id!,
      data,
      expiresAt,
    } as AttestInput);
  }

  async issueAmlScreening(
    subject: `0x${string}`,
    passed: boolean,
    provider: string
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("bool passed, string provider, uint64 checkedAt"),
      [passed, provider, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId:  KYC_SCHEMAS.AML_SCREENING.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }

  async issueAccreditedInvestor(
    subject: `0x${string}`,
    jurisdiction: string,
    validUntil: number,
    provider: string
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string jurisdiction, uint64 validUntil, string provider"),
      [jurisdiction, BigInt(validUntil), provider]
    );
    return this.issue({
      subject,
      schemaId:  KYC_SCHEMAS.ACCREDITED_INVESTOR.id!,
      data,
      expiresAt: validUntil,
    } as AttestInput);
  }

  async issueAgeGate(
    subject: `0x${string}`,
    over18: boolean,
    provider: string
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("bool over18, uint64 checkedAt, string provider"),
      [over18, BigInt(Math.floor(Date.now() / 1000)), provider]
    );
    return this.issue({
      subject,
      schemaId:  KYC_SCHEMAS.AGE_OVER_18.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }
}

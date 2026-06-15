import { encodeAbiParameters, parseAbiParameters } from "viem";
import { BaseAttestationService, type AttestInput } from "../base/BaseAttestationService.js";
import { CREDENTIAL_SCHEMAS } from "../../../constants/schemas.js";

export class CredentialAttestationService extends BaseAttestationService {
  constructor() {
    super("credentials", process.env.CIRCLE_CREDENTIALS_ISSUER_WALLET_ID ?? "");
  }

  async issueCertification(
    subject: `0x${string}`,
    certName: string,
    issuingBody: string,
    certId: string,
    validUntil: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string certName, string issuingBody, string certId, uint64 issuedAt, uint64 validUntil"),
      [certName, issuingBody, certId, BigInt(Math.floor(Date.now() / 1000)), BigInt(validUntil)]
    );
    return this.issue({
      subject,
      schemaId:  CREDENTIAL_SCHEMAS.CERTIFICATION.id!,
      data,
      expiresAt: validUntil,
    } as AttestInput);
  }

  async issueLicense(
    subject: `0x${string}`,
    licenseType: string,
    licenseNumber: string,
    jurisdiction: string,
    issuingBody: string,
    validUntil: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string licenseType, string licenseNumber, string jurisdiction, string issuingBody, uint64 validUntil"),
      [licenseType, licenseNumber, jurisdiction, issuingBody, BigInt(validUntil)]
    );
    return this.issue({
      subject,
      schemaId:  CREDENTIAL_SCHEMAS.LICENSE.id!,
      data,
      expiresAt: validUntil,
    } as AttestInput);
  }

  async endorseSkill(
    subject: `0x${string}`,
    skill: string,
    level: number,
    endorsedBy: `0x${string}`
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string skill, uint8 level, address endorsedBy"),
      [skill, level, endorsedBy]
    );
    return this.issue({
      subject,
      schemaId:  CREDENTIAL_SCHEMAS.SKILL_ENDORSEMENT.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }
}

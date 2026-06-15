import { encodeAbiParameters, parseAbiParameters } from "viem";
import { BaseAttestationService, type AttestInput } from "../base/BaseAttestationService.js";
import { IDENTITY_SCHEMAS } from "../../../constants/schemas.js";

export class IdentityAttestationService extends BaseAttestationService {
  constructor() {
    super("identity", process.env.CIRCLE_IDENTITY_ISSUER_WALLET_ID ?? "");
  }

  async issueBasicIdentity(
    subject: `0x${string}`,
    displayName: string,
    avatarCid: string,
    expiresAt: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string displayName, string avatarCid, uint64 createdAt"),
      [displayName, avatarCid, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId: IDENTITY_SCHEMAS.BASIC_IDENTITY.id!,
      data,
      expiresAt,
    } as AttestInput);
  }

  async issueLivenessVerified(
    subject: `0x${string}`,
    verified: boolean,
    provider: string,
    expiresAt: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("bool verified, string provider, uint64 checkedAt"),
      [verified, provider, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId: IDENTITY_SCHEMAS.LIVENESS_VERIFIED.id!,
      data,
      expiresAt,
    } as AttestInput);
  }
}

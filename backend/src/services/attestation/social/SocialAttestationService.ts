import { encodeAbiParameters, parseAbiParameters } from "viem";
import { BaseAttestationService, type AttestInput } from "../base/BaseAttestationService.js";
import { SOCIAL_SCHEMAS } from "../../../constants/schemas.js";

export class SocialAttestationService extends BaseAttestationService {
  constructor() {
    super("social", process.env.CIRCLE_SOCIAL_ISSUER_WALLET_ID ?? "");
  }

  async linkAccount(
    subject: `0x${string}`,
    platform: string,
    handle: string,
    profileId: string,
    expiresAt: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string platform, string handle, string profileId, uint64 verifiedAt"),
      [platform, handle, profileId, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId:  SOCIAL_SCHEMAS.SOCIAL_ACCOUNT.id!,
      data,
      expiresAt,
    } as AttestInput);
  }

  async issueHumanityProof(
    subject: `0x${string}`,
    verified: boolean,
    mechanism: string,
    nullifier: `0x${string}`
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("bool verified, string mechanism, bytes32 nullifier, uint64 checkedAt"),
      [verified, mechanism, nullifier, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId:  SOCIAL_SCHEMAS.HUMANITY_PROOF.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }

  async issueFollowerMilestone(
    subject: `0x${string}`,
    platform: string,
    followerCount: number,
    milestone: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string platform, uint32 followerCount, uint32 milestone, uint64 verifiedAt"),
      [platform, followerCount, milestone, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId:  SOCIAL_SCHEMAS.FOLLOWER_MILESTONE.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }
}

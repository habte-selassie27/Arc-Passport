import { encodeAbiParameters, parseAbiParameters } from "viem";
import { BaseAttestationService, type AttestInput } from "../base/BaseAttestationService.js";
import { DAO_SCHEMAS } from "../../../constants/schemas.js";

export class DaoAttestationService extends BaseAttestationService {
  constructor() {
    super("dao", process.env.CIRCLE_DAO_ISSUER_WALLET_ID ?? "");
  }

  async issueMembership(
    subject: `0x${string}`,
    daoName: string,
    daoAddress: `0x${string}`,
    role: string,
    votingWeight: bigint
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string daoName, address daoAddress, string role, uint64 joinedAt, uint256 votingWeight"),
      [daoName, daoAddress, role, BigInt(Math.floor(Date.now() / 1000)), votingWeight]
    );
    return this.issue({
      subject,
      schemaId:  DAO_SCHEMAS.DAO_MEMBERSHIP.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }

  async issueParticipation(
    subject: `0x${string}`,
    daoAddress: `0x${string}`,
    proposalsPassed: number,
    votesParticipated: number,
    delegatesCount: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("address daoAddress, uint32 proposalsPassed, uint32 votesParticipated, uint32 delegatesCount, uint64 updatedAt"),
      [daoAddress, proposalsPassed, votesParticipated, delegatesCount, BigInt(Math.floor(Date.now() / 1000))]
    );
    return this.issue({
      subject,
      schemaId:  DAO_SCHEMAS.GOVERNANCE_PARTICIPATION.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }

  async issueDelegate(
    subject: `0x${string}`,
    daoAddress: `0x${string}`,
    delegatedFrom: `0x${string}`[],
    statement: string
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("address daoAddress, address[] delegatedFrom, string statement"),
      [daoAddress, delegatedFrom, statement]
    );
    return this.issue({
      subject,
      schemaId:  DAO_SCHEMAS.DELEGATE.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }
}

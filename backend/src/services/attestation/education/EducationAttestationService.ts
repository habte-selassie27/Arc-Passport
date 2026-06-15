import { encodeAbiParameters, parseAbiParameters } from "viem";
import { BaseAttestationService, type AttestInput } from "../base/BaseAttestationService.js";
import { EDUCATION_SCHEMAS } from "../../../constants/schemas.js";

export class EducationAttestationService extends BaseAttestationService {
  constructor() {
    super("education", process.env.CIRCLE_EDUCATION_ISSUER_WALLET_ID ?? "");
  }

  async issueDegree(
    subject: `0x${string}`,
    institution: string,
    degree: string,
    fieldOfStudy: string,
    graduationYear: number
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string institution, string degree, string fieldOfStudy, uint16 graduationYear, string institutionDid"),
      [institution, degree, fieldOfStudy, graduationYear, ""]
    );
    return this.issue({
      subject,
      schemaId:  EDUCATION_SCHEMAS.DEGREE.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }

  async issueCourseCompletion(
    subject: `0x${string}`,
    courseName: string,
    provider: string,
    score: number,
    certificateId: string
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string courseName, string provider, uint8 score, uint64 completedAt, string certificateId"),
      [courseName, provider, score, BigInt(Math.floor(Date.now() / 1000)), certificateId]
    );
    return this.issue({
      subject,
      schemaId:  EDUCATION_SCHEMAS.COURSE_COMPLETION.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }

  async issueBootcamp(
    subject: `0x${string}`,
    bootcamp: string,
    track: string,
    projectUri: string
  ): Promise<`0x${string}`> {
    const data = encodeAbiParameters(
      parseAbiParameters("string bootcamp, string track, uint64 graduatedAt, string projectUri"),
      [bootcamp, track, BigInt(Math.floor(Date.now() / 1000)), projectUri]
    );
    return this.issue({
      subject,
      schemaId:  EDUCATION_SCHEMAS.BOOTCAMP_GRADUATE.id!,
      data,
      expiresAt: 0,
    } as AttestInput);
  }
}

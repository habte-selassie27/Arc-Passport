import { BaseAttestationService, type AttestInput } from "../base/BaseAttestationService.js";

export class CustomAttestationService extends BaseAttestationService {
  constructor() {
    super("custom", process.env.CIRCLE_CUSTOM_ISSUER_WALLET_ID ?? "");
  }

  async issueCustom(input: AttestInput): Promise<`0x${string}`> {
    return this.issue(input);
  }
}

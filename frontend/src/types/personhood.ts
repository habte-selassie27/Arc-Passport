/** Shared types for humanity/personhood verification across mechanisms. */

export type PersonhoodState =
  | "initialized"
  | "verified"
  | "attesting"
  | "complete"
  | "failed"
  | "expired";

export interface PersonhoodStatus {
  subject: string;
  verified: boolean;
  onChain: boolean;
  state: PersonhoodState | null;
  claimId?: string;
  mechanism?: string;
  checkedAt?: number;
  expiresAt?: number;
}

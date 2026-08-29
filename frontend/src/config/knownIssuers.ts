/**
 * Known issuer registry — maps issuer addresses to human-readable metadata.
 * This is a frontend-only registry for the request credential UX.
 * In production, this would come from an on-chain registry or API.
 */

export interface KnownIssuer {
  address: `0x${string}`;
  name: string;
  description: string;
  /** Which credential types this issuer can grant. */
  credentialTypes: string[];
  /** Optional avatar/logo (emoji for now, URL later). */
  icon: string;
}

export const KNOWN_ISSUERS: KnownIssuer[] = [
  {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    name: "Arc KYC Team",
    description: "Official Arc identity verification — KYC, AML screening, and age verification.",
    credentialTypes: ["kyc", "identity"],
    icon: "🛡️",
  },
  {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    name: "Arc Credentials",
    description: "Professional certifications, skills, and employment verification on Arc.",
    credentialTypes: ["credentials", "employment"],
    icon: "📜",
  },
  {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    name: "Arc DAO Hub",
    description: "DAO membership and governance participation records.",
    credentialTypes: ["dao"],
    icon: "🏛️",
  },
  {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    name: "Arc Reputation",
    description: "Community reputation scores and social verification.",
    credentialTypes: ["reputation", "social"],
    icon: "⭐",
  },
  {
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    name: "Arc Education",
    description: "Academic degrees, certifications, and continuing education records.",
    credentialTypes: ["education"],
    icon: "🎓",
  },
];

/**
 * Get issuers that can grant a specific credential type.
 */
export function getIssuersForType(serviceType: string): KnownIssuer[] {
  return KNOWN_ISSUERS.filter((issuer) =>
    issuer.credentialTypes.includes(serviceType)
  );
}

/**
 * Get all unique credential types from known issuers.
 */
export function getAllCredentialTypes(): string[] {
  const types = new Set<string>();
  for (const issuer of KNOWN_ISSUERS) {
    for (const type of issuer.credentialTypes) {
      types.add(type);
    }
  }
  return Array.from(types).sort();
}

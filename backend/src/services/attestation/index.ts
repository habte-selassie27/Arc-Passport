import { BaseAttestationService } from "./base/BaseAttestationService.js";

export type ServiceKey =
  | "identity" | "kyc" | "credentials" | "dao"
  | "reputation" | "employment" | "education" | "social" | "custom";

export const ALL_SERVICE_KEYS: readonly ServiceKey[] = [
  "identity", "kyc", "credentials", "dao",
  "reputation", "employment", "education", "social", "custom",
] as const;

/** Env var suffix for each service's Circle issuer wallet ID. */
const WALLET_ENV_MAP: Record<ServiceKey, string> = {
  identity:    "CIRCLE_IDENTITY_ISSUER_WALLET_ID",
  kyc:         "CIRCLE_KYC_ISSUER_WALLET_ID",
  credentials: "CIRCLE_CREDENTIALS_ISSUER_WALLET_ID",
  dao:         "CIRCLE_DAO_ISSUER_WALLET_ID",
  reputation:  "CIRCLE_REPUTATION_ISSUER_WALLET_ID",
  employment:  "CIRCLE_EMPLOYMENT_ISSUER_WALLET_ID",
  education:   "CIRCLE_EDUCATION_ISSUER_WALLET_ID",
  social:      "CIRCLE_SOCIAL_ISSUER_WALLET_ID",
  custom:      "CIRCLE_CUSTOM_ISSUER_WALLET_ID",
};

const registry = Object.fromEntries(
  ALL_SERVICE_KEYS.map((key) => [
    key,
    new BaseAttestationService(key, process.env[WALLET_ENV_MAP[key]] ?? ""),
  ])
) as Record<ServiceKey, BaseAttestationService>;

export function getService(key: ServiceKey): BaseAttestationService {
  return registry[key];
}

export function getAllServices(): { key: ServiceKey; service: BaseAttestationService }[] {
  return Object.entries(registry).map(([key, service]) => ({
    key: key as ServiceKey,
    service: service as BaseAttestationService,
  }));
}

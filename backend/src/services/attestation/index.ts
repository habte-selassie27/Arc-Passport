import { IdentityAttestationService } from "./identity/IdentityAttestationService.js";
import { KycAttestationService } from "./kyc/KycAttestationService.js";
import { CredentialAttestationService } from "./credentials/CredentialAttestationService.js";
import { DaoAttestationService } from "./dao/DaoAttestationService.js";
import { ReputationAttestationService } from "./reputation/ReputationAttestationService.js";
import { EmploymentAttestationService } from "./employment/EmploymentAttestationService.js";
import { EducationAttestationService } from "./education/EducationAttestationService.js";
import { SocialAttestationService } from "./social/SocialAttestationService.js";
import { CustomAttestationService } from "./custom/CustomAttestationService.js";
import { BaseAttestationService } from "./base/BaseAttestationService.js";

export type ServiceKey =
  | "identity" | "kyc" | "credentials" | "dao"
  | "reputation" | "employment" | "education" | "social" | "custom";

const registry = {
  identity:    new IdentityAttestationService(),
  kyc:         new KycAttestationService(),
  credentials: new CredentialAttestationService(),
  dao:         new DaoAttestationService(),
  reputation:  new ReputationAttestationService(),
  employment:  new EmploymentAttestationService(),
  education:   new EducationAttestationService(),
  social:      new SocialAttestationService(),
  custom:      new CustomAttestationService(),
} as const satisfies Record<ServiceKey, BaseAttestationService>;

export function getService(key: ServiceKey): BaseAttestationService {
  return registry[key];
}

export function getAllServices(): { key: ServiceKey; service: BaseAttestationService }[] {
  return Object.entries(registry).map(([key, service]) => ({
    key: key as ServiceKey,
    service: service as BaseAttestationService,
  }));
}

export const ALL_SERVICE_KEYS: readonly ServiceKey[] = [
  "identity", "kyc", "credentials", "dao",
  "reputation", "employment", "education", "social", "custom",
] as const;

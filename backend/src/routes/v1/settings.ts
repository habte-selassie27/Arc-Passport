import { Router, Request, Response } from "express";

const router = Router();

const WALLET_ENV_KEYS: Record<string, string> = {
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

router.get("/status", (_req: Request, res: Response) => {
  const status: Record<string, { configured: boolean; walletId: string | null }> = {};

  for (const [service, envKey] of Object.entries(WALLET_ENV_KEYS)) {
    const walletId = process.env[envKey] ?? null;
    status[service] = {
      configured: !!walletId && walletId.length > 0,
      walletId: walletId ? `${walletId.slice(0, 8)}...` : null,
    };
  }

  const configuredCount = Object.values(status).filter((s) => s.configured).length;

  res.json({
    success: true,
    data: {
      services: status,
      configuredCount,
      totalCount: Object.keys(status).length,
      blockchain: process.env.ARC_BLOCKCHAIN_ENV ?? "ARC-TESTNET",
    },
  });
});

export default router;

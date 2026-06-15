export const RETENTION_POLICY = {
  claimDataAfterExpiry: 90 * 24 * 60 * 60 * 1000,
  apiLogRetention: 30 * 24 * 60 * 60 * 1000,
  erasureAuditRetention: 7 * 365 * 24 * 60 * 60 * 1000,
} as const;

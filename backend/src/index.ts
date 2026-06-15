import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/errorHandler.js";
import identityRoutes from "./routes/identity.js";
import attestationRoutes from "./routes/attestation.js";
import reputationRoutes from "./routes/reputation.js";
import passportRoutes from "./routes/passport.js";
import schemaRoutes from "./routes/schema.js";
import issuerRoutes from "./routes/issuer.js";
import { startClaimIndexer } from "./indexer/claimIndexer.js";
import { startGasPricePolling, startBalancePolling, startEventWatchers } from "./monitoring/eventMonitor.js";
import { RETENTION_POLICY } from "./config/retention.js";
import kycRoutesV1 from "./routes/v1/kyc.js";
import credentialsRoutesV1 from "./routes/v1/credentials.js";
import daoRoutesV1 from "./routes/v1/dao.js";
import identityRoutesV1 from "./routes/v1/identity.js";
import reputationRoutesV1 from "./routes/v1/reputation.js";
import employmentRoutesV1 from "./routes/v1/employment.js";
import educationRoutesV1 from "./routes/v1/education.js";
import socialRoutesV1 from "./routes/v1/social.js";
import customRoutesV1 from "./routes/v1/custom.js";
import passportRoutesV1 from "./routes/v1/passport.js";
import bulkRoutesV1 from "./routes/v1/bulk.js";
import openapiRoutesV1 from "./routes/v1/openapi.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

// Global rate limit — all routes
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED" } },
  })
);

// Strict rate limit on all v1 service write endpoints: max 10 per address per minute.
// These all route through the same Circle issuer wallet, so a flood from one address
// can drain gas for all services. Per AGENTS.md §15.5.3.
const v1WriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => (req.headers["x-wallet-address"] as string) || req.ip || "unknown",
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many write requests (max 5/min)" } },
});

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", timestamp: Date.now() } });
});

app.get("/retention-policy", (_req, res) => {
  res.json({ success: true, data: RETENTION_POLICY });
});

app.use("/identity", identityRoutes);
app.use("/attestation", attestationRoutes);
app.use("/reputation", reputationRoutes);
app.use("/passport", passportRoutes);
app.use("/schema", schemaRoutes);
app.use("/issuer", issuerRoutes);

app.use("/v1/kyc", v1WriteLimiter, kycRoutesV1);
app.use("/v1/credentials", v1WriteLimiter, credentialsRoutesV1);
app.use("/v1/dao", v1WriteLimiter, daoRoutesV1);
app.use("/v1/identity", v1WriteLimiter, identityRoutesV1);
app.use("/v1/reputation", v1WriteLimiter, reputationRoutesV1);
app.use("/v1/employment", v1WriteLimiter, employmentRoutesV1);
app.use("/v1/education", v1WriteLimiter, educationRoutesV1);
app.use("/v1/social", v1WriteLimiter, socialRoutesV1);
app.use("/v1/custom", v1WriteLimiter, customRoutesV1);
app.use("/v1/passport", passportRoutesV1);
app.use("/v1/bulk", bulkRoutesV1);
app.use("/v1", openapiRoutesV1);

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`ArcPass backend listening on port ${PORT}`);
    startClaimIndexer();
    startGasPricePolling(30_000);
    startBalancePolling(300_000);
    startEventWatchers();
  });
}

export default app;

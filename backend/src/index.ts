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
import { startGasPricePolling, startBalancePolling } from "./monitoring/eventMonitor.js";
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

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED" } },
  })
);

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

app.use("/v1/kyc", kycRoutesV1);
app.use("/v1/credentials", credentialsRoutesV1);
app.use("/v1/dao", daoRoutesV1);
app.use("/v1/identity", identityRoutesV1);
app.use("/v1/reputation", reputationRoutesV1);
app.use("/v1/employment", employmentRoutesV1);
app.use("/v1/education", educationRoutesV1);
app.use("/v1/social", socialRoutesV1);
app.use("/v1/custom", customRoutesV1);
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
  });
}

export default app;

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
import scoreRoutes from "./routes/score.js";
import easRoutes from "./routes/eas.js";
import { startClaimIndexer } from "./indexer/claimIndexer.js";
import { startGasPricePolling, startBalancePolling, startEventWatchers } from "./monitoring/eventMonitor.js";
import { RETENTION_POLICY } from "./config/retention.js";
import serviceRoutesV1 from "./routes/v1/service.js";
import bulkRoutesV1 from "./routes/v1/bulk.js";
import analyticsRoutesV1 from "./routes/v1/analytics.js";
import settingsRoutesV1 from "./routes/v1/settings.js";
import notificationsRoutesV1 from "./routes/v1/notifications.js";
import requestsRoutesV1 from "./routes/v1/requests.js";
import openapiRoutesV1 from "./routes/v1/openapi.js";
import verifyRoutesV1 from "./routes/v1/verify.js";
import zkRoutes from "./routes/zk.js";
import humanNodeRoutes from "./routes/human-node.js";
import web2ProofRoutes from "./routes/web2-proof.js";
import openid3Routes from "./routes/openid3.js";
import uploadRoutes from "./routes/upload.js";
import { startExpirySweep } from "./services/notificationService.js";
import { startIndexer as startEASIndexer } from "./indexer/easIndexer.js";

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
app.use("/score", scoreRoutes);
app.use("/eas", easRoutes);
app.use("/zk", zkRoutes);
app.use("/human-node", humanNodeRoutes);
app.use("/web2-proof", web2ProofRoutes);
app.use("/openid3", openid3Routes);
app.use("/upload", uploadRoutes);

// Mount the specific /v1/* routers BEFORE serviceRoutesV1: it registers
// catch-all patterns like GET /:service/schemas that would otherwise shadow
// e.g. GET /v1/requests/schemas and return INVALID_SERVICE.
app.use("/v1/bulk", bulkRoutesV1);
app.use("/v1/analytics", analyticsRoutesV1);
app.use("/v1/settings", settingsRoutesV1);
app.use("/v1/notifications", notificationsRoutesV1);
app.use("/v1/requests", requestsRoutesV1);
app.use("/v1/verify", verifyRoutesV1);
app.use("/v1", v1WriteLimiter, serviceRoutesV1);
app.use("/v1", openapiRoutesV1);

// JSON 404 catch-all — unmatched routes return the standard error envelope,
// never Express's default HTML page (which the frontend's res.json() calls would
// choke on with a cryptic SyntaxError).
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
});

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`ArcPass backend listening on port ${PORT}`);
    startClaimIndexer();
    startEASIndexer();
    startExpirySweep();
    startGasPricePolling(30_000);
    startBalancePolling(300_000);
    startEventWatchers();
  });
}

export default app;

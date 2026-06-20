import { Router, Request, Response } from "express";
import { getEventAnalytics } from "../../monitoring/eventMonitor.js";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  try {
    const events = getEventAnalytics();
    res.json({ success: true, data: { events, generatedAt: Date.now() } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "ANALYTICS_ERROR", message: (err as Error).message } });
  }
});

export default router;

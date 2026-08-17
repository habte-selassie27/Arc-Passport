import { Router, Request, Response } from "express";
import { requireSignedNonce } from "../../middleware/auth.js";
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from "../../services/notificationService.js";

const router = Router();

/** GET /v1/notifications — the verified address's notifications, newest first. */
router.get("/", requireSignedNonce, (_req: Request, res: Response) => {
  const address = _req.verifiedAddress!;
  const notifications = getNotifications(address);
  res.json({ success: true, data: { notifications } });
});

/** GET /v1/notifications/unread-count — cheap badge count for the UI. */
router.get("/unread-count", requireSignedNonce, (_req: Request, res: Response) => {
  res.json({ success: true, data: { unread: getUnreadCount(_req.verifiedAddress!) } });
});

/** POST /v1/notifications/read — mark one ({ id }) or all ({ all: true }) as read. */
router.post("/read", requireSignedNonce, (req: Request, res: Response) => {
  const { id, all } = req.body as { id?: string; all?: boolean };
  const address = req.verifiedAddress!;

  if (all) {
    const marked = markAllRead(address);
    res.json({ success: true, data: { marked } });
    return;
  }

  if (!id) {
    res.status(400).json({ success: false, error: { code: "MISSING_FIELD", message: "id or all required" } });
    return;
  }

  const ok = markRead(address, id);
  if (!ok) {
    res.status(404).json({ success: false, error: { code: "NOTIFICATION_NOT_FOUND", message: "Notification not found" } });
    return;
  }
  res.json({ success: true, data: { id } });
});

export default router;

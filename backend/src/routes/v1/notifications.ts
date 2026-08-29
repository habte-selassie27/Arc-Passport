import { Router, Request, Response } from "express";
import { requireSignedNonce } from "../../middleware/auth.js";
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from "../../services/notificationService.js";

const router = Router();

/** GET /v1/notifications/:address — public endpoint, no auth needed. */
router.get("/:address", (req: Request, res: Response) => {
  const address = req.params.address as `0x${string}`;
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    res.status(400).json({ success: false, error: { code: "INVALID_ADDRESS", message: "Invalid address" } });
    return;
  }
  const notifications = getNotifications(address);
  res.json({ success: true, data: { notifications } });
});

/** GET /v1/notifications/:address/unread-count — cheap badge count. */
router.get("/:address/unread-count", (req: Request, res: Response) => {
  const address = req.params.address as `0x${string}`;
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    res.status(400).json({ success: false, error: { code: "INVALID_ADDRESS", message: "Invalid address" } });
    return;
  }
  res.json({ success: true, data: { unread: getUnreadCount(address) } });
});

/** POST /v1/notifications/read — requires wallet signature (mutates state). */
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

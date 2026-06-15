import { Router, Request, Response } from "express";
import { getPassport } from "../../services/passportService.js";

const router = Router();

router.get("/:address", async (req: Request, res: Response) => {
  try {
    const passport = await getPassport(req.params.address as `0x${string}`);
    res.json({ success: true, data: passport });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "PASSPORT_ERROR", message: (err as Error).message },
    });
  }
});

export default router;

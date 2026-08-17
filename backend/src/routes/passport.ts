import { Router, Request, Response } from "express";
import { getPassport } from "../services/passportService.js";
import { waitForIndexerReady } from "../indexer/claimIndexer.js";
import { isValidAddress } from "../utils/address.js";

const router = Router();

router.get("/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    if (!isValidAddress(address)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ADDRESS", message: "Invalid Ethereum address" },
      });
      return;
    }
    await waitForIndexerReady();
    const passport = await getPassport(address as `0x${string}`);
    res.json({ success: true, data: passport });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "PASSPORT_ERROR", message: (err as Error).message },
    });
  }
});

export default router;

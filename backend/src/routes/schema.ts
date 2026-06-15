import { Router, Request, Response } from "express";
import { publicClient } from "../services/arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { SCHEMA_REGISTRY_ABI } from "../abis/SchemaRegistry.js";
import { executeContractCall } from "../services/circleService.js";
import { requireSignedNonce } from "../middleware/auth.js";
import { computeSchemaId } from "../utils/schemaHash.js";

const router = Router();

router.post("/register", requireSignedNonce, async (req: Request, res: Response) => {
  try {
    const { name, version, fieldsJson } = req.body;
    if (!name || !version || !fieldsJson) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "name, version, fieldsJson required" },
      });
      return;
    }

    const schemaId = computeSchemaId(name, version, fieldsJson);

    // Check if already registered
    const exists = await publicClient.readContract({
      address: ADDRESSES.schemaRegistry!,
      abi: SCHEMA_REGISTRY_ABI,
      functionName: "isRegistered",
      args: [schemaId],
    });

    if (exists) {
      res.status(409).json({
        success: false,
        error: { code: "SCHEMA_EXISTS", message: "Schema already registered", data: { schemaId } },
      });
      return;
    }

    const walletId = process.env.CIRCLE_ISSUER_WALLET_ID;
    if (!walletId) throw new Error("CIRCLE_ISSUER_WALLET_ID not configured");
    if (!ADDRESSES.schemaRegistry) throw new Error("SCHEMA_REGISTRY_ADDRESS not configured");

    const txHash = await executeContractCall(
      walletId,
      ADDRESSES.schemaRegistry,
      "registerSchema(string,string,string)",
      [name, version, fieldsJson]
    );

    res.json({ success: true, data: { schemaId, txHash } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "REGISTER_FAILED", message: (err as Error).message },
    });
  }
});

router.get("/:schemaId", async (req: Request, res: Response) => {
  try {
    if (!ADDRESSES.schemaRegistry) throw new Error("SCHEMA_REGISTRY_ADDRESS not configured");

    const schema = await publicClient.readContract({
      address: ADDRESSES.schemaRegistry,
      abi: SCHEMA_REGISTRY_ABI,
      functionName: "getSchema",
      args: [req.params.schemaId as `0x${string}`],
    });

    res.json({ success: true, data: schema });
  } catch (err) {
    res.status(404).json({
      success: false,
      error: { code: "SCHEMA_NOT_FOUND", message: (err as Error).message },
    });
  }
});

export default router;

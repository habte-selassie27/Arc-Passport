import { Router, Request, Response } from "express";
import { publicClient } from "../services/arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { requireSignedNonce } from "../middleware/auth.js";

const router = Router();

router.get("/check", requireSignedNonce, async (req: Request, res: Response) => {
  try {
    const caller = req.verifiedAddress!;
    if (!ADDRESSES.attestationRegistry) {
      res.json({ success: true, data: { isIssuer: false, reason: "CONTRACT_NOT_CONFIGURED" } });
      return;
    }

    const ISSUER_ROLE = (await publicClient.readContract({
      address: ADDRESSES.attestationRegistry,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "ISSUER_ROLE",
    })) as `0x${string}`;

    const hasRole = await publicClient.readContract({
      address: ADDRESSES.attestationRegistry,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "hasRole",
      args: [ISSUER_ROLE, caller],
    });

    res.json({ success: true, data: { isIssuer: hasRole, address: caller } });
  } catch (err) {
    res.status(502).json({
      success: false,
      error: { code: "CHECK_FAILED", message: (err as Error).message },
    });
  }
});

export default router;

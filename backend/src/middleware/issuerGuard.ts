import { Request, Response, NextFunction } from "express";
import { publicClient } from "../services/arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";

export async function issuerGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const caller = req.verifiedAddress;
  if (!caller) {
    res.status(401).json({
      success: false,
      error: { code: "NO_ADDRESS", message: "No verified address" },
    });
    return;
  }

  if (!ADDRESSES.attestationRegistry) {
    res.status(500).json({
      success: false,
      error: { code: "NO_CONTRACT", message: "AttestationRegistry not configured" },
    });
    return;
  }

  try {
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

    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: { code: "NOT_ISSUER", message: `${caller} does not hold ISSUER_ROLE` },
      });
      return;
    }
  } catch (err) {
    res.status(502).json({
      success: false,
      error: { code: "CHAIN_ERROR", message: "Failed to check issuer role onchain" },
    });
    return;
  }

  next();
}

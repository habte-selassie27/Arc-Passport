import { hashMessage, recoverAddress, encodePacked, keccak256 } from "viem";
import * as jose from "jose";

// ── DAuth Signer ──
const DAUTH_SIGNER = "0xf3b4e49Fd77A959B704f6a045eeA92bd55b3b571".toLowerCase();
const DAUTH_JWKS_URL = "https://demo-api.dauth.network/dauth/sdk/v1.1/jwks.json";

// ── Types ──

export interface DAuthProof {
  auth: {
    acc_and_type_hash: string;
    request_id: string;
    account_plain?: string;
  };
  signature: string;
}

export interface DAuthResult {
  mode: "proof" | "jwt" | "both";
  data: DAuthProof | string | { jwt: string; proof: DAuthProof };
}

export interface VerifiedIdentity {
  provider: string;
  accountHandle: string;
  accountId: string;
  verified: boolean;
}

// ── Proof Verification ──

export async function verifyProof(proof: DAuthProof, signerAddress: string = DAUTH_SIGNER): Promise<boolean> {
  try {
    const { auth, signature } = proof;
    const sig = `0x${signature}` as `0x${string}`;
    const { acc_and_type_hash, request_id } = auth;

    const request_id_hash =
      request_id.length === 64
        ? encodePacked(["bytes32"], [`0x${request_id}` as `0x${string}`])
        : keccak256(new TextEncoder().encode(request_id));

    const msg = encodePacked(
      ["bytes32", "bytes32"],
      [`0x${acc_and_type_hash}` as `0x${string}`, request_id_hash as `0x${string}`]
    );

    const msgHash = keccak256(msg);
    const msgHashWithPrefix = hashMessage({ raw: msgHash });
    const recoveredAddress = await recoverAddress({
      hash: msgHashWithPrefix,
      signature: sig,
    });

    return recoveredAddress.toLowerCase() === signerAddress.toLowerCase();
  } catch {
    return false;
  }
}

// ── JWT Verification ──

let remoteJWKS: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getRemoteJWKS() {
  if (!remoteJWKS) {
    remoteJWKS = jose.createRemoteJWKSet(new URL(DAUTH_JWKS_URL));
  }
  return remoteJWKS;
}

export async function verifyJwt(jwt: string): Promise<jose.JWTVerifyResult> {
  const JWKS = getRemoteJWKS();
  return jose.jwtVerify(jwt, JWKS as any, {
    issuer: "dauth.network",
  });
}

// ── Extract Identity from DAuth Result ──

export async function extractIdentity(
  result: DAuthResult,
  providerHint: string
): Promise<VerifiedIdentity> {
  if (result.mode === "proof" || (result.mode === "both" && typeof result.data === "object" && "auth" in result.data)) {
    const proof = result.mode === "proof" ? (result.data as DAuthProof) : (result.data as { proof: DAuthProof }).proof;
    return {
      provider: providerHint,
      accountHandle: proof.auth.account_plain ?? proof.auth.acc_and_type_hash.slice(0, 16),
      accountId: proof.auth.acc_and_type_hash,
      verified: await verifyProof(proof),
    };
  }

  if (result.mode === "jwt" && typeof result.data === "string") {
    const payload = jose.decodeJwt(result.data);
    return {
      provider: providerHint,
      accountHandle: (payload.sub as string) ?? "unknown",
      accountId: (payload.sub as string) ?? "unknown",
      verified: true,
    };
  }

  if (result.mode === "both" && typeof result.data === "object" && "jwt" in result.data) {
    const payload = jose.decodeJwt(result.data.jwt);
    return {
      provider: providerHint,
      accountHandle: (payload.sub as string) ?? "unknown",
      accountId: (payload.sub as string) ?? "unknown",
      verified: true,
    };
  }

  throw new Error("Unrecognized DAuth result format");
}

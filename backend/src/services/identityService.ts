import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { IDENTITY_REGISTRY_ABI } from "../abis/IdentityRegistry.js";
import { rpcGate } from "../utils/rpcSemaphore.js";

/**
 * Arc's IdentityRegistry predeploy is a plain ERC-721: register() mints a token,
 * tokenURI(tokenId) points at profile metadata. There is no getIdentity() and no
 * enumeration — mapping an owner to tokens requires scanning mint events.
 *
 * The RPC aggressively rate-limits eth_getLogs, so registration history is fetched
 * from ArcScan's Etherscan-compatible API instead (single HTTP call, no rate limits).
 * Owner/tokenURI checks still go through the RPC (simple readContract calls, not getLogs).
 */

const ARCSCAN_API = "https://testnet.arcscan.app/api";
const IDENTITY_NFT_CONTRACT = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

export async function getIdentityBalance(address: `0x${string}`): Promise<number> {
  try {
    const balance = await publicClient.readContract({
      address: ADDRESSES.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    return Number(balance);
  } catch {
    return 0;
  }
}

// ── Registration history ──────────────────────────────────────────────────

const HISTORY_CACHE_TTL_MS = 120_000;

export type RegistrationStatus = "active" | "burned" | "transferred";

export interface RegistrationRecord {
  tokenId: number;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  status: RegistrationStatus;
  metadataUri: string | null;
}

export interface RegistrationHistory {
  address: string;
  balance: number;
  identity: { tokenId: number; metadataUri: string | null } | null;
  registrations: RegistrationRecord[];
  partialScan: boolean;
  olderTokensOutsideWindow: boolean;
}

const historyCache = new Map<string, { data: RegistrationHistory; expiresAt: number }>();
const inflightScans = new Map<string, Promise<RegistrationHistory>>();

export async function getIdentity(address: `0x${string}`): Promise<{ tokenId: number; metadataUri: string | null } | null> {
  const history = await getRegistrationHistory(address);
  return history.identity;
}

export async function getRegistrationHistory(address: `0x${string}`): Promise<RegistrationHistory> {
  const key = address.toLowerCase();
  const cached = historyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  // If a scan is already in progress for this address, reuse it.
  const inflight = inflightScans.get(key);
  if (inflight) return inflight;

  const promise = _scanRegistrationHistory(address).finally(() => inflightScans.delete(key));
  inflightScans.set(key, promise);

  const result = await promise;
  const ttl = result.partialScan ? 15_000 : HISTORY_CACHE_TTL_MS;
  historyCache.set(key, { data: result, expiresAt: Date.now() + ttl });
  if (historyCache.size > 200) {
    const firstKey = historyCache.keys().next().value;
    if (firstKey) historyCache.delete(firstKey);
  }
  return result;
}

/**
 * Fetch all NFT transfers from ArcScan API — single HTTP call, no eth_getLogs,
 * no rate limits. Then check ownerOf + tokenURI for each token via RPC.
 */
async function _scanRegistrationHistory(address: `0x${string}`): Promise<RegistrationHistory> {
  const balance = await getIdentityBalance(address);

  // Fetch all NFT transfers for this address from ArcScan.
  // Returns mints (from = zero address) + any outgoing transfers.
  let arcscanTx: Array<{
    tokenID: string;
    blockNumber: string;
    hash: string;
    timeStamp: string;
    from: string;
    to: string;
  }> = [];

  try {
    const url = `${ARCSCAN_API}?module=account&action=tokennfttx&contractaddress=${IDENTITY_NFT_CONTRACT}&address=${address}&page=1&offset=200`;
    const res = await fetch(url);
    const json = await res.json() as { status: string; result: Array<Record<string, string>> };
    if (json.status === "1" && Array.isArray(json.result)) {
      arcscanTx = json.result as unknown as typeof arcscanTx;
    }
  } catch (err) {
    console.warn("[identity] ArcScan API failed:", (err as Error).message);
  }

  // Build registrations from ArcScan data
  const registrations: RegistrationRecord[] = [];
  let rateLimited = false;

  if (arcscanTx.length === 0 && balance > 0) {
    // ArcScan returned nothing but wallet has tokens — API may be down
    rateLimited = true;
  }

  for (const tx of arcscanTx) {
    const isMint = tx.from === "0x0000000000000000000000000000000000000000";
    const isTransferToThis = tx.to.toLowerCase() === address.toLowerCase();

    if (isMint && isTransferToThis) {
      registrations.push({
        tokenId: Number(tx.tokenID),
        txHash: tx.hash,
        blockNumber: Number(tx.blockNumber),
        timestamp: Number(tx.timeStamp),
        status: "active",
        metadataUri: null,
      });
    }
  }

  // Check ownerOf + tokenURI for each found registration via RPC
  for (const reg of registrations) {
    try {
      const owner = await rpcGate(() =>
        publicClient.readContract({
          address: ADDRESSES.identityRegistry,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "ownerOf",
          args: [BigInt(reg.tokenId)],
        })
      );
      reg.status =
        (owner as string).toLowerCase() === address.toLowerCase() ? "active" : "transferred";

      if (reg.status === "active") {
        try {
          const uri = await rpcGate(() =>
            publicClient.readContract({
              address: ADDRESSES.identityRegistry,
              abi: IDENTITY_REGISTRY_ABI,
              functionName: "tokenURI",
              args: [BigInt(reg.tokenId)],
            })
          );
          reg.metadataUri = uri as string;
        } catch { /* metadata is optional */ }
      }
    } catch {
      reg.status = "burned";
    }
  }

  registrations.sort((a, b) => b.blockNumber - a.blockNumber || b.txHash.localeCompare(a.txHash));

  const active = registrations.filter((r) => r.status === "active");
  const identity = active.length > 0 ? { tokenId: active[0].tokenId, metadataUri: active[0].metadataUri } : null;

  return {
    address,
    balance,
    identity,
    registrations,
    partialScan: rateLimited || (registrations.length === 0 && balance > 0),
    olderTokensOutsideWindow: false,
  };
}

import { createPublicClient, createWalletClient, http, webSocket, type PublicClient } from "viem";
import { arcTestnet } from "../config/arc.js";

// HTTP client for historical reads (getLogs, readContract, getBlock, etc.)
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.ARC_RPC_URL),
});

// WebSocket client for live event watchers — no more polling getLogs every 30s.
// Falls back to HTTP if WS_URL is not configured.
const WS_URL = process.env.ARC_WS_RPC_URL;
export const wsClient: PublicClient | null = WS_URL
  ? createPublicClient({
      chain: arcTestnet,
      transport: webSocket(WS_URL),
    })
  : null;

import { publicClient } from "../services/arcService.js";
import { getWalletBalance } from "../services/circleService.js";
import { ADDRESSES } from "../config/arc.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { SCHEMA_REGISTRY_ABI } from "../abis/SchemaRegistry.js";
import { formatUnits } from "viem";

const ALERT_THRESHOLDS = {
  attestationsPerMinute: 50,
  revocationsPerMinute: 20,
  roleGrantsPerHour: 2,
  schemaRegistrations: 5,
  /** Alert when issuer wallet USDC balance drops below this threshold (in USDC units). */
  issuerWalletLowBalance: 10,
};

let lastGasPriceWei = 0n;
let gasPricePollInterval: ReturnType<typeof setInterval> | null = null;
let balancePollInterval: ReturnType<typeof setInterval> | null = null;

export interface MonitoredEvent {
  name: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  logIndex: number;
}

const eventBuckets: Record<string, number[]> = {
  ClaimIssued: [],
  ClaimRevoked: [],
  RoleGranted: [],
  SchemaRegistered: [],
  MemoSent: [],
  Blocklisted: [],
  UnBlocklisted: [],
};

export function startGasPricePolling(intervalMs = 30_000) {
  if (gasPricePollInterval) clearInterval(gasPricePollInterval);

  const poll = async () => {
    try {
      const price = await publicClient.getGasPrice();
      lastGasPriceWei = price;
      const usdcGwei = Number(formatUnits(price, 9));
      console.debug(`[gas] ${usdcGwei.toFixed(2)} Gwei (${Number(formatUnits(price, 18)).toFixed(6)} USDC)`);

      if (usdcGwei < 20) {
        console.warn(`[ALERT] Gas price below minimum (${usdcGwei.toFixed(2)} Gwei < 20) — txs may stall`);
      }
      if (usdcGwei > 200) {
        console.warn(`[ALERT] Gas price spike: ${usdcGwei.toFixed(2)} Gwei`);
      }
    } catch (err) {
      console.error("[gas] Failed to fetch gas price:", (err as Error).message);
    }
  };

  poll();
  gasPricePollInterval = setInterval(poll, intervalMs);
}

export function getLastGasPrice(): bigint {
  return lastGasPriceWei;
}

export function processEvent(event: MonitoredEvent) {
  const now = Date.now();
  const bucket = eventBuckets[event.name];
  if (!bucket) return;

  bucket.push(now);

  const oneMinuteAgo = now - 60_000;
  const oneHourAgo = now - 3_600_000;

  while (bucket.length > 0 && bucket[0] < oneHourAgo) {
    bucket.shift();
  }

  const lastMinute = bucket.filter((t) => t >= oneMinuteAgo).length;

  switch (event.name) {
    case "ClaimIssued":
      if (lastMinute > ALERT_THRESHOLDS.attestationsPerMinute) {
        console.warn(`[ALERT] ClaimIssued rate: ${lastMinute}/min (threshold: ${ALERT_THRESHOLDS.attestationsPerMinute})`);
      }
      break;

    case "ClaimRevoked":
      if (lastMinute > ALERT_THRESHOLDS.revocationsPerMinute) {
        console.warn(`[ALERT] ClaimRevoked rate: ${lastMinute}/min (threshold: ${ALERT_THRESHOLDS.revocationsPerMinute})`);
      }
      break;

    case "RoleGranted":
      if (event.args.role) {
        console.error(`[CRITICAL ALERT] RoleGranted: ${event.args.role} granted to ${event.args.account}`);
      }
      break;

    case "SchemaRegistered":
      if (lastMinute > ALERT_THRESHOLDS.schemaRegistrations) {
        console.warn(`[ALERT] SchemaRegistered rate: ${lastMinute}/min`);
      }
      break;

    case "MemoSent":
      console.info(`[INFO] MemoSent: sender=${event.args.sender} recipient=${event.args.recipient}`);
      break;

    case "Blocklisted":
      console.error(`[CRITICAL ALERT] USDC Blocklisted: ${event.args.account} added to blocklist`);
      break;

    case "UnBlocklisted":
      console.warn(`[WARN] USDC UnBlocklisted: ${event.args.account} removed from blocklist`);
      break;
  }
}

/**
 * Polls the issuer wallet's USDC balance every `intervalMs` (default 5 minutes).
 * Alerts if the balance drops below ALERT_THRESHOLDS.issuerWalletLowBalance (10 USDC).
 * Required by AGENTS.md §15.8.2 — the issuer wallet funds all onchain transactions;
 * a drained wallet silently stops the service.
 */
export function startBalancePolling(intervalMs = 300_000) {
  if (balancePollInterval) clearInterval(balancePollInterval);

  const walletId = process.env.CIRCLE_ISSUER_WALLET_ID;
  if (!walletId) {
    console.warn("[balance-monitor] CIRCLE_ISSUER_WALLET_ID not set, skipping balance polling");
    return;
  }

  const poll = async () => {
    try {
      const rawBalance = await getWalletBalance(walletId);
      // Circle returns the amount in the token's smallest unit. For USDC (6 decimals),
      // parseUnits converts the raw amount to a human-readable USDC value.
      const balance = Number(formatUnits(BigInt(rawBalance), 6));
      console.debug(`[balance] Issuer wallet: ${balance.toFixed(2)} USDC`);

      if (balance < ALERT_THRESHOLDS.issuerWalletLowBalance) {
        console.error(
          `[ALERT] Issuer wallet balance LOW: ${balance.toFixed(2)} USDC ` +
          `(threshold: ${ALERT_THRESHOLDS.issuerWalletLowBalance} USDC)`
        );
      }
    } catch (err) {
      console.error("[balance] Failed to fetch wallet balance:", (err as Error).message);
    }
  };

  poll();
  balancePollInterval = setInterval(poll, intervalMs);
}

export function stopBalancePolling() {
  if (balancePollInterval) {
    clearInterval(balancePollInterval);
    balancePollInterval = null;
  }
}

/**
 * Starts live event watchers for RoleGranted and SchemaRegistered events.
 * ClaimIssued and ClaimRevoked are handled by claimIndexer.ts (which calls
 * processEvent). This function covers the remaining event types that the
 * monitor needs to track for anomaly detection per AGENTS.md §15.8.1.
 */
export function startEventWatchers() {
  if (ADDRESSES.attestationRegistry) {
    publicClient.watchContractEvent({
      address: ADDRESSES.attestationRegistry,
      abi: ATTESTATION_REGISTRY_ABI,
      eventName: "RoleGranted",
      onLogs: (logs) => {
        for (const log of logs) {
          processEvent({
            name: "RoleGranted",
            args: log.args as Record<string, unknown>,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex ?? 0,
          });
        }
      },
    });
  }

  if (ADDRESSES.schemaRegistry) {
    publicClient.watchContractEvent({
      address: ADDRESSES.schemaRegistry,
      abi: SCHEMA_REGISTRY_ABI,
      eventName: "SchemaRegistered",
      onLogs: (logs) => {
        for (const log of logs) {
          processEvent({
            name: "SchemaRegistered",
            args: log.args as Record<string, unknown>,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex ?? 0,
          });
        }
      },
    });
  }
}

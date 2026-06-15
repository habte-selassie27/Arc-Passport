import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export function getCircleClient() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey) throw new Error("CIRCLE_API_KEY not set");
  if (!entitySecret) throw new Error("CIRCLE_ENTITY_SECRET not set");

  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
}

export function assertBlockchain(blockchain: string) {
  const allowed = process.env.ARC_BLOCKCHAIN_ENV || "ARC-TESTNET";
  if (blockchain !== allowed) {
    throw new Error(
      `CHAIN MISMATCH: attempted ${blockchain}, env is set to ${allowed}`
    );
  }
}

/**
 * Step 2: Create 9 issuer wallets on Arc Testnet via Circle Developer-Controlled Wallets.
 *
 * Prerequisites:
 *   - CIRCLE_API_KEY set in backend/.env (from Circle Console)
 *   - CIRCLE_ENTITY_SECRET set in backend/.env (from RegisterEntitySecret.ts)
 *
 * Usage:
 *   npx tsx contracts/script/SetupCircleWallets.ts
 *
 * Creates:
 *   - 1 wallet set ("ArcPass Issuers")
 *   - 9 EOA wallets (one per attestation service)
 *   - Updates backend/.env with wallet IDs
 */
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env values manually since tsx --env-file isn't always used
function loadEnv(): Record<string, string> {
  const envPath = resolve(import.meta.dirname, "../../backend/.env");
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  } catch {
    // ignore — will check required vars below
  }
  return env;
}

const env = loadEnv();
const apiKey = env.CIRCLE_API_KEY;
const entitySecret = env.CIRCLE_ENTITY_SECRET;

if (!apiKey || !entitySecret) {
  console.error("ERROR: CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be set in backend/.env");
  console.error("");
  console.error("Steps:");
  console.error("  1. Get API key from https://dev.console.circle.com → API Keys → Create a key");
  console.error("  2. Run: CIRCLE_API_KEY=your_key npx tsx contracts/script/RegisterEntitySecret.ts");
  console.error("  3. Then run this script again.");
  process.exit(1);
}

const SERVICES = [
  "identity", "kyc", "credentials", "dao",
  "reputation", "employment", "education", "social", "custom",
] as const;

const ENV_KEYS = {
  identity:    "CIRCLE_IDENTITY_ISSUER_WALLET_ID",
  kyc:         "CIRCLE_KYC_ISSUER_WALLET_ID",
  credentials: "CIRCLE_CREDENTIALS_ISSUER_WALLET_ID",
  dao:         "CIRCLE_DAO_ISSUER_WALLET_ID",
  reputation:  "CIRCLE_REPUTATION_ISSUER_WALLET_ID",
  employment:  "CIRCLE_EMPLOYMENT_ISSUER_WALLET_ID",
  education:   "CIRCLE_EDUCATION_ISSUER_WALLET_ID",
  social:      "CIRCLE_SOCIAL_ISSUER_WALLET_ID",
  custom:      "CIRCLE_CUSTOM_ISSUER_WALLET_ID",
} as const;

async function main() {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  // 1. Create wallet set
  console.log("Creating wallet set 'ArcPass Issuers'...");
  const walletSetRes = await client.createWalletSet({
    name: "ArcPass Issuers",
  });

  const walletSet = walletSetRes.data?.walletSet;
  if (!walletSet?.id) {
    console.error("Wallet set creation failed:", JSON.stringify(walletSetRes.data, null, 2));
    process.exit(1);
  }
  console.log(`✅ Wallet set created: ${walletSet.id}`);

  // 2. Create 9 wallets in one batch
  console.log(`\nCreating ${SERVICES.length} wallets on ARC-TESTNET...`);
  const walletRes = await client.createWallets({
    walletSetId: walletSet.id,
    blockchains: ["ARC-TESTNET"],
    count: SERVICES.length,
    accountType: "EOA",
  });

  const wallets = walletRes.data?.wallets;
  if (!wallets || wallets.length < SERVICES.length) {
    console.error("Wallet creation failed:", JSON.stringify(walletRes.data, null, 2));
    process.exit(1);
  }

  // 3. Print results and update backend/.env
  const envPath = resolve(import.meta.dirname, "../../backend/.env");
  let envContent = readFileSync(envPath, "utf8");

  console.log("\n✅ Wallets created:\n");
  for (let i = 0; i < SERVICES.length; i++) {
    const service = SERVICES[i];
    const wallet = wallets[i];
    const envKey = ENV_KEYS[service];

    console.log(`  ${service.padEnd(14)} → wallet ${wallet.id}  address ${wallet.address}`);

    // Update or append env var
    const regex = new RegExp(`^${envKey}=.*$`, "m");
    const line = `${envKey}=${wallet.id}`;
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, line);
    } else {
      envContent += `\n${line}`;
    }
  }

  // Also store wallet set ID
  const wsRegex = /^CIRCLE_WALLET_SET_ID=.*$/m;
  const wsLine = `CIRCLE_WALLET_SET_ID=${walletSet.id}`;
  if (wsRegex.test(envContent)) {
    envContent = envContent.replace(wsRegex, wsLine);
  } else {
    envContent += `\n${wsLine}`;
  }

  writeFileSync(envPath, envContent);
  console.log(`\n✅ backend/.env updated with all wallet IDs`);
  console.log("\nRestart the backend to pick up the new wallet IDs:");
  console.log("  lsof -ti :3001 | xargs kill -9");
  console.log("  cd backend && npm run dev");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});

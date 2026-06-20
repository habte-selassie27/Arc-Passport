/**
 * Step 1: Generate and register an Entity Secret with Circle.
 *
 * Usage:
 *   1. Get your CIRCLE_API_KEY from https://dev.console.circle.com
 *   2. Add it to backend/.env:  CIRCLE_API_KEY=your_key_here
 *   3. Run:  CIRCLE_API_KEY=your_key npx tsx contracts/script/RegisterEntitySecret.ts
 *
 * This generates a 32-byte secret, registers it with Circle, saves a
 * recovery file to ./recovery/, and appends CIRCLE_ENTITY_SECRET to .env.
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import { resolve } from "node:path";

async function main() {
  const apiKey: string | undefined = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    console.error("ERROR: Set CIRCLE_API_KEY first.");
    console.error("Get one from https://dev.console.circle.com → API Keys → Create a key");
    process.exit(1);
  }

  // Refuse to overwrite if already set
  const backendEnvPath = resolve(import.meta.dirname, "../../backend/.env");
  const existingEnv: string = existsSync(backendEnvPath)
    ? readFileSync(backendEnvPath, "utf8")
    : "";
  if (/^CIRCLE_ENTITY_SECRET=/m.test(existingEnv)) {
    console.error("CIRCLE_ENTITY_SECRET already exists in backend/.env. Remove it first to re-register.");
    process.exit(1);
  }

  // Generate 32-byte entity secret
  const entitySecret: string = randomBytes(32).toString("hex");
  const recoveryPath = resolve(import.meta.dirname, "../../recovery");

  mkdirSync(recoveryPath, { recursive: true });

  console.log("Registering entity secret with Circle...");
  await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: recoveryPath,
  });

  // Append to backend/.env
  appendFileSync(backendEnvPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`);

  console.log("\n✅ Entity secret registered!");
  console.log(`✅ Recovery file saved to: ${recoveryPath}/`);
  console.log("✅ CIRCLE_ENTITY_SECRET appended to backend/.env");
  console.log("\n⚠️  SAVE THE RECOVERY FILE — it's the only way to reset your secret if lost.");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});

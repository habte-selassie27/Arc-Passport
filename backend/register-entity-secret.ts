import { randomBytes } from "node:crypto";
import { readFileSync, appendFileSync } from "node:fs";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) throw new Error("CIRCLE_API_KEY missing");

// Generate new secret
const entitySecret = randomBytes(32).toString("hex");
console.log(`\nRaw entity secret (save this!):\n${entitySecret}\n`);

// Encrypt it using Circle's public key and register
const result = await registerEntitySecretCiphertext({
  apiKey,
  entitySecret,
  recoveryFileDownloadPath: "./recovery",
});

// Save to .env
appendFileSync(".env", `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`);
console.log("Added CIRCLE_ENTITY_SECRET to .env");
console.log("Recovery file saved to ./recovery/");
console.log("\nNow upload the recovery .dat file from ./recovery/ in the Circle Reset dialog.");

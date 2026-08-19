import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import forge from "node-forge";

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) throw new Error("CIRCLE_API_KEY missing");

// 1. Get the entity public key from Circle
const keyRes = await fetch("https://api.circle.com/v1/w3s/config/entity/publicKey", {
  headers: { Authorization: `Bearer ${apiKey}` },
});
const keyData = await keyRes.json() as { data: { publicKey: string } };
const publicKeyPem = keyData.data.publicKey;
console.log("Got entity public key from Circle");

// 2. Generate a new 32-byte entity secret
const entitySecret = randomBytes(32).toString("hex");
console.log(`\nRaw entity secret (save this!):\n${entitySecret}\n`);

// 3. Encrypt with RSA-OAEP (SHA-256)
const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
const ciphertext = publicKey.encrypt(
  forge.util.hexToBytes(entitySecret),
  "RSA-OAEP",
  { md: forge.md.sha256.create(), mgf1: { md: forge.md.sha256.create() } }
);
const ciphertextBase64 = forge.util.encode64(ciphertext);
console.log(`New entity secret ciphertext:\n${ciphertextBase64}\n`);

// 4. Save the raw secret to .env
appendFileSync(".env", `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`);
console.log("Added CIRCLE_ENTITY_SECRET to .env");
console.log("\nNow paste the ciphertext into the Reset dialog in Circle console.");
console.log("Also upload the old recovery file from: recovery/recovery_file_1781949809629.dat");

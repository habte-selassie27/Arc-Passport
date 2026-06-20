/**
 * uploadIdentityMetadata.ts
 *
 * Uploads identity metadata JSON to IPFS via Pinata and prints the CID.
 * Use the output CID with RegisterIdentity.s.sol:
 *   METADATA_CID=<cid> DEPLOYMENT_ENV=testnet forge script ...
 *
 * Usage:
 *   1. Set PINATA_API_KEY and PINATA_SECRET_KEY in backend/.env
 *   2. Run:  npx tsx contracts/script/uploadIdentityMetadata.ts [name] [avatarCid]
 *
 * Example:
 *   npx tsx contracts/script/uploadIdentityMetadata.ts "Alice" "QmAvatar123"
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv(): { pinataApiKey: string; pinataSecretKey: string } {
  const envPath = resolve(import.meta.dirname ?? __dirname, "../../backend/.env");
  const env = readFileSync(envPath, "utf-8");
  const get = (key: string) => {
    const match = env.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match?.[1]?.trim() ?? "";
  };
  const pinataApiKey = get("PINATA_API_KEY");
  const pinataSecretKey = get("PINATA_SECRET_KEY");
  if (!pinataApiKey) throw new Error("PINATA_API_KEY not set in backend/.env");
  if (!pinataSecretKey) throw new Error("PINATA_SECRET_KEY not set in backend/.env");
  return { pinataApiKey, pinataSecretKey };
}

async function uploadToPinata(
  data: Record<string, unknown>,
  apiKey: string,
  secretKey: string,
  name: string,
): Promise<string> {
  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataMetadata: { name },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinata upload failed: ${response.status} ${text}`);
  }

  const result = (await response.json()) as { IpfsHash: string };
  return `ipfs://${result.IpfsHash}`;
}

async function main() {
  const displayName = process.argv[2] || "ArcPass Deployer";
  const avatarCid = process.argv[3] || "";

  const { pinataApiKey, pinataSecretKey } = loadEnv();

  const metadata = {
    arcpass_version: "1.0",
    type: "identity",
    name: displayName,
    description: `ArcPass identity for ${displayName}`,
    image: avatarCid ? `ipfs://${avatarCid}` : undefined,
    created_at: new Date().toISOString(),
    attributes: [
      { trait_type: "registered_on", value: "Arc Testnet" },
      { trait_type: "protocol", value: "ArcPass v1.0" },
    ],
  };

  console.log("Uploading identity metadata to IPFS...");
  const cid = await uploadToPinata(
    metadata,
    pinataApiKey,
    pinataSecretKey,
    `arcpass-identity-${displayName.toLowerCase().replace(/\s+/g, "-")}`,
  );

  console.log(`\nMetadata CID: ${cid}`);
  console.log(`\nUse with RegisterIdentity.s.sol:`);
  console.log(`  METADATA_CID=${cid} DEPLOYMENT_ENV=testnet forge script script/RegisterIdentity.s.sol --rpc-url https://rpc.testnet.arc.network --broadcast`);
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});

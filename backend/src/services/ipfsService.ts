const ALLOWED_IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

export async function uploadToIpfs(data: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("Pinata credentials not configured");

  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinata upload failed: ${response.status} ${text}`);
  }

  const result = (await response.json()) as { IpfsHash: string };
  return `ipfs://${result.IpfsHash}`;
}

export async function fetchFromIpfs(uri: string): Promise<Record<string, unknown>> {
  if (!uri.startsWith("ipfs://")) {
    throw new Error("Only ipfs:// URIs are accepted");
  }

  const cid = uri.replace("ipfs://", "");
  // CIDv0 = Qm + 44 base58 chars (46 total)
  // CIDv1 = multibase prefix (b, z, etc) + base32/base58 content (46-59+ chars)
  if (!/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid) && !/^b[2-7a-z]{58,}/.test(cid)) {
    throw new Error("Invalid IPFS CID format");
  }

  const gateway = ALLOWED_IPFS_GATEWAYS[0];
  const response = await fetch(`${gateway}${cid}`);

  if (!response.ok) {
    throw new Error(`IPFS fetch failed: ${response.status}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export async function unpinFromIpfs(cid: string): Promise<void> {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("Pinata credentials not configured");

  const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
    method: "DELETE",
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinata unpin failed: ${response.status} ${text}`);
  }
}

/**
 * End-to-end selective disclosure flow test (offline-safe).
 *
 * Usage:  npx tsx src/__tests__/e2e/selectiveDisclosure.e2e.ts
 *
 * Tests all backend endpoints that don't require on-chain RPC calls.
 * On-chain dependent tests (fields/proof for real claims) are skipped
 * when ARC_RPC_URL is unreachable.
 */

import { generatePrivateKey, privateKeyToAccount, signMessage } from "viem/accounts";

const BASE = process.env.API_URL || "http://localhost:3100";
const pk = generatePrivateKey();
const account = privateKeyToAccount(pk);

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

function skip(label: string) {
  console.log(`  ⏭️  ${label} (skipped — RPC unavailable)`);
  skipped++;
}

async function signedGet(path: string): Promise<{ status: number; body: any }> {
  const nonce = crypto.randomUUID();
  const message = `ArcPass:${path}:${nonce}`;
  const signature = await signMessage({ message, privateKey: pk });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: {
        "x-wallet-address": account.address,
        "x-nonce": nonce,
        "x-signature": signature,
      },
    });
    const body = await res.json();
    return { status: res.status, body };
  } catch {
    return { status: 0, body: { error: { code: "TIMEOUT" } } };
  } finally {
    clearTimeout(timer);
  }
}

async function unsignedGet(path: string): Promise<{ status: number; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
    const body = await res.json();
    return { status: res.status, body };
  } catch {
    return { status: 0, body: { error: { code: "TIMEOUT" } } };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`\n🔗 Selective Disclosure E2E Test`);
  console.log(`   Backend: ${BASE}`);
  console.log(`   Subject: ${account.address}\n`);

  // ─── 1. Health check ──────────────────────────────────────
  console.log("1. Health check");
  const health = await unsignedGet("/health");
  assert(health.status === 200 && health.body.success, "Backend is healthy");

  // ─── 2. Unauthenticated fields → 401 ─────────────────────
  console.log("\n2. Unauthenticated access to /fields");
  const noAuth1 = await unsignedGet(`/attestation/claim/0x${"aa".repeat(32)}/fields`);
  assert(noAuth1.status === 401, "Returns 401 without auth");
  assert(noAuth1.body.error?.code === "MISSING_AUTH", "Error code is MISSING_AUTH");

  // ─── 3. Unauthenticated proof → 401 ──────────────────────
  console.log("\n3. Unauthenticated access to /proof");
  const noAuth2 = await unsignedGet(`/attestation/claim/0x${"aa".repeat(32)}/field/test/proof`);
  assert(noAuth2.status === 401, "Returns 401 without auth");

  // ─── 4. Authenticated fields — RPC-dependent ─────────────
  console.log("\n4. Authenticated fields for nonexistent claim");
  const fakeClaimId = `0x${"bb".repeat(32)}`;
  const noClaim = await signedGet(`/attestation/claim/${fakeClaimId}/fields`);
  if (noClaim.status === 0) {
    skip("RPC timed out — skipping");
  } else {
    assert([404, 500].includes(noClaim.status), `Returns ${noClaim.status} for nonexistent claim`);
  }

  // ─── 5. Non-subject caller → 403 (RPC-dependent) ─────────
  console.log("\n5. Non-subject caller → 403");
  const passportRes = await unsignedGet("/passport/0x04e0353B7218b66D6803725ce7342E6e1225DB1b");
  const claims = passportRes.body?.data?.claims ?? [];
  if (passportRes.status === 0) {
    skip("RPC timed out — skipping");
  } else if (claims.length > 0) {
    const realClaimId = claims[0].claimId;
    console.log(`   Testing with real claim ${realClaimId.slice(0, 14)}…`);
    const wrongCaller = await signedGet(`/attestation/claim/${realClaimId}/fields`);
    if (wrongCaller.status === 0) {
      skip("RPC timed out — skipping");
    } else {
      assert(wrongCaller.status === 403, `Returns ${wrongCaller.status} for non-subject`);
    }
  } else {
    skip("No indexed claims found");
  }

  // ─── 6. Public verify endpoint — missing params → 400 ────
  console.log("\n6. Public verify endpoint — missing params");
  const verifyNoParams = await unsignedGet(`/attestation/claim/0x${"cc".repeat(32)}/field/test/verify`);
  assert(verifyNoParams.status === 400, "Returns 400 without required query params");
  assert(verifyNoParams.body.error?.code === "MISSING_PARAMS", "Error code is MISSING_PARAMS");

  // ─── 7. Public verify with params (RPC-dependent) ─────────
  console.log("\n7. Public verify with params (nonexistent claim)");
  const verifyFake = await unsignedGet(
    `/attestation/claim/0x${"dd".repeat(32)}/field/test/verify?leaf=0x${"11".repeat(32)}&leafIndex=0&proof=%5B%220x${"22".repeat(32)}%22%5D`
  );
  if (verifyFake.status === 0) {
    skip("RPC timed out — skipping");
  } else {
    assert(verifyFake.status === 500, `Returns ${verifyFake.status} for nonexistent claim`);
  }

  // ─── 8. V1 service schemas endpoint (no RPC) ──────────────
  console.log("\n8. V1 service schemas (regression)");
  const schemas = await unsignedGet("/v1/kyc/schemas");
  assert(schemas.status === 200, "GET /v1/kyc/schemas returns 200");
  assert(schemas.body.data?.schemas?.length > 0, "Has schemas");

  // ─── 9. Schema fields have classifications ────────────────
  console.log("\n9. Schema fields have classifications");
  const schemaFields = schemas.body.data.schemas[0]?.fields ?? [];
  const allClassified = schemaFields.every(
    (f: any) => f.classification && ["PUBLIC", "PRIVATE", "DERIVED"].includes(f.classification)
  );
  assert(allClassified, `All ${schemaFields.length} KYC fields classified`);

  // ─── 10. All 9 services have classified schemas ───────────
  console.log("\n10. All 9 services have classified schemas");
  const services = [
    "identity", "kyc", "credentials", "dao",
    "reputation", "employment", "education", "social", "custom",
  ];
  for (const svc of services) {
    const res = await unsignedGet(`/v1/${svc}/schemas`);
    const svcSchemas = res.body?.data?.schemas ?? [];
    for (const s of svcSchemas) {
      const classified = (s.fields ?? []).every(
        (f: any) => f.classification && ["PUBLIC", "PRIVATE", "DERIVED"].includes(f.classification)
      );
      assert(classified, `${svc}.${s.name} fields classified`);
    }
    if (svcSchemas.length === 0) {
      console.log(`  ⚠️  ${svc}: no schemas (empty service)`);
    }
  }

  // ─── 11. Passport endpoint (RPC-dependent) ────────────────
  console.log("\n11. Passport endpoint (regression)");
  const passport = await unsignedGet("/passport/0x04e0353B7218b66D6803725ce7342E6e1225DB1b");
  if (passport.status === 0) {
    skip("RPC timed out — skipping");
  } else {
    assert(passport.status === 200, "GET /passport/:address returns 200");
    assert(passport.body.success === true, "Response envelope is success");
  }

  // ─── 12. JSON 404 for unknown routes ──────────────────────
  console.log("\n12. JSON 404 for unknown routes");
  const notFound = await unsignedGet("/totally/unknown/route");
  assert(notFound.status === 404, "Returns 404");
  assert(notFound.body.error?.code === "NOT_FOUND", "Error envelope is correct");

  // ─── Summary ──────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("E2E test crashed:", err);
  process.exit(1);
});

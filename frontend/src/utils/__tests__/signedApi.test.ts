import { describe, it, expect, vi, afterEach } from "vitest";
import { signedFetch } from "../signedApi";

const ADDRESS: `0x${string}` = `0x${"aa".repeat(20)}`;
const SIGNATURE: `0x${string}` = `0x${"bb".repeat(32)}`;

function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({ json: async () => body, status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("signedFetch", () => {
  it("signs `ArcPass:{path}:{nonce}` and sends the nonce, signature, and wallet address as headers", async () => {
    vi.stubGlobal("fetch", mockFetchResponse({ success: true, data: { ok: true } }));

    let signedMessage = "";
    const signMessage = vi.fn(async ({ message }: { message: string }) => {
      signedMessage = message;
      return SIGNATURE;
    });

    const result = await signedFetch({ path: "/v1/passport/0xabc", address: ADDRESS, signMessage });

    expect(result).toEqual({ ok: true });
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:3001/v1/passport/0xabc"); // dev API fallback
    expect(init.method).toBe("GET");
    expect(init.headers["x-wallet-address"]).toBe(ADDRESS);
    expect(init.headers["x-signature"]).toBe(SIGNATURE);

    const nonce = init.headers["x-nonce"];
    expect(nonce).toMatch(/^[0-9a-f-]{36}$/);
    expect(signedMessage).toBe(`ArcPass:/v1/passport/0xabc:${nonce}`);
  });

  it("sends a JSON body for mutating requests", async () => {
    vi.stubGlobal("fetch", mockFetchResponse({ success: true, data: { issued: 1 } }));
    const signMessage = vi.fn(async (_args: { message: string }) => SIGNATURE);

    await signedFetch({
      path: "/attestations",
      address: ADDRESS,
      signMessage,
      method: "POST",
      body: { schemaId: `0x${"11".repeat(32)}`, subject: ADDRESS },
    });

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ schemaId: `0x${"11".repeat(32)}`, subject: ADDRESS });
  });

  it("throws the backend error message when the API returns success: false", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({ success: false, error: { code: "NOT_ISSUER", message: "No issuer role" } })
    );
    const signMessage = vi.fn(async (_args: { message: string }) => SIGNATURE);

    await expect(
      signedFetch({ path: "/attestations", address: ADDRESS, signMessage, method: "POST", body: {} })
    ).rejects.toThrow("No issuer role");
  });

  it("throws a status-based message when the backend omits an error message", async () => {
    vi.stubGlobal("fetch", mockFetchResponse({ success: false, error: {} }, 500));
    const signMessage = vi.fn(async (_args: { message: string }) => SIGNATURE);

    await expect(
      signedFetch({ path: "/v1/passport/0xabc", address: ADDRESS, signMessage })
    ).rejects.toThrow("Request failed (500)");
  });
});

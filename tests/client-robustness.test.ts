import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SmoobuClient, canonicalQuery } from "../src/smoobu-client.js";
const json = (data = {}) => new Response(JSON.stringify(data));
const options = { apiKey: "fake-key", apiSecret: "fake-secret", baseUrl: "https://example.invalid", allowWrites: false };
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe("HTTP safety", () => {
  it("canonicalizes repeated params, spaces, reserved punctuation without locale sorting", () => {
    const url = new URL("https://example.invalid");
    url.searchParams.append("z", "é !'()*"); url.searchParams.append("apartments[]", "2"); url.searchParams.append("apartments[]", "10"); url.searchParams.append("A", "~");
    expect(canonicalQuery(url)).toBe("A=~&apartments%5B%5D=10&apartments%5B%5D=2&z=%C3%A9%20%21%27%28%29%2A");
  });
  it("signs exact serialized POST body", async () => {
    const fetcher = vi.fn().mockResolvedValue(json());
    await new SmoobuClient({ ...options, allowWrites: true, fetch: fetcher }).mutate("POST", "/api/rates", { apartments: [1], operations: [{ dates: ["2026-12-01"], daily_price: 99 }] });
    const init = fetcher.mock.calls[0][1]; const h = init.headers;
    const canonical = ["POST", "/api/rates", "", h["X-Timestamp"], h["X-Nonce"], createHash("sha256").update(init.body).digest("hex"), "fake-key"].join("\n");
    expect(h["X-Signature"]).toBe(createHmac("sha256", "fake-secret").update(canonical).digest("base64"));
    expect(init.redirect).toBe("error");
  });
  it.each([401,403,404,400,422,500,429])("normalizes %s without echoing secrets", async status => {
    const fetcher = vi.fn().mockResolvedValue(new Response("fake-key fake-secret <html>private</html>", { status }));
    const result = await new SmoobuClient({ ...options, maxReadRetries: 0, fetch: fetcher }).request("/api/me");
    expect(result).toMatchObject({ error: true, status }); expect(JSON.stringify(result)).not.toMatch(/fake-key|fake-secret|private/);
  });
  it.each([200,201,204])("rejects undocumented empty successful %s", async status => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }));
    expect(await new SmoobuClient({ ...options, fetch: fetcher }).request("/api/me")).toMatchObject({code:"INVALID_RESPONSE"});
  });
  it("reports malformed JSON without retry", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("<html>oops</html>"));
    expect(await new SmoobuClient({ ...options, fetch: fetcher }).request("/api/me")).toMatchObject({ code: "INVALID_RESPONSE" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["seconds","date","vendor","both"])("waits for %s Retry-After and renews nonce", async mode => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const headers: Record<string,string> = mode === "seconds" ? { "Retry-After": "2" } : mode === "date" ? { "Retry-After": "Thu, 01 Jan 2026 00:00:02 GMT" } : mode === "vendor" ? { "X-RateLimit-Retry-After": String(Date.now()/1000+2) } : { "Retry-After": "1", "X-RateLimit-Retry-After": String(Date.now()/1000+2) };
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status:429, headers })).mockResolvedValueOnce(json({ ok:true }));
    const pending = new SmoobuClient({ ...options, fetch: fetcher }).request("/api/me");
    await vi.advanceTimersByTimeAsync(1999); expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(await pending).toEqual({ ok:true });
    expect(fetcher.mock.calls[0][1].headers["X-Nonce"]).not.toBe(fetcher.mock.calls[1][1].headers["X-Nonce"]);
  });
  it("bounds read retries at three attempts", async () => {
    vi.useFakeTimers(); const fetcher = vi.fn().mockImplementation(() => new Response("", {status:503}));
    const pending = new SmoobuClient({ ...options, fetch: fetcher }).request("/api/me");
    await vi.runAllTimersAsync(); expect(await pending).toMatchObject({status:503}); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it.each([429,500])("never retries mutation %s", async status => {
    const fetcher = vi.fn().mockResolvedValue(new Response("", {status}));
    expect(await new SmoobuClient({ ...options, allowWrites:true, fetch:fetcher }).mutate("POST", "/api/rates", {})).toMatchObject({status}); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never retries ambiguous mutation network failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("fake-secret"));
    const result = await new SmoobuClient({ ...options, allowWrites:true, fetch:fetcher }).mutate("POST", "/api/rates", {});
    expect(result).toMatchObject({ code:"API_ERROR", message: expect.stringContaining("unknown") }); expect(fetcher).toHaveBeenCalledTimes(1); expect(JSON.stringify(result)).not.toContain("fake-secret");
  });
  it("shares 429 cooldown with following mutations without retrying them", async () => {
    vi.useFakeTimers(); const fetcher = vi.fn().mockResolvedValueOnce(new Response("", {status:429,headers:{"Retry-After":"2"}})).mockResolvedValueOnce(json());
    const client = new SmoobuClient({ ...options, allowWrites:true, fetch:fetcher });
    await client.mutate("POST", "/api/rates", {}); const pending = client.mutate("POST", "/api/rates", {});
    await vi.advanceTimersByTimeAsync(1999); expect(fetcher).toHaveBeenCalledTimes(1); await vi.advanceTimersByTimeAsync(1); await pending; expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("caps 700 attempts per rolling minute", async () => {
    vi.useFakeTimers(); const fetcher = vi.fn().mockImplementation(() => json());
    const client = new SmoobuClient({ ...options, timeoutMs:70000, fetch:fetcher });
    await Promise.all(Array.from({length:700},()=>client.request("/api/me")));
    const pending = client.request("/api/me"); await vi.advanceTimersByTimeAsync(59999); expect(fetcher).toHaveBeenCalledTimes(700); await vi.advanceTimersByTimeAsync(1); await pending; expect(fetcher).toHaveBeenCalledTimes(701);
  });
  it("deadline includes backoff and supports cancellation", async () => {
    vi.useFakeTimers(); const fetcher = vi.fn().mockResolvedValue(new Response("",{status:429,headers:{"Retry-After":"120"}}));
    const pending = new SmoobuClient({ ...options, fetch:fetcher, timeoutMs:100 }).request("/api/me"); await vi.advanceTimersByTimeAsync(100); expect(await pending).toMatchObject({code:"TIMEOUT"}); expect(fetcher).toHaveBeenCalledTimes(1);
    const controller = new AbortController(); controller.abort();
    expect(await new SmoobuClient({ ...options, fetch:fetcher }).request("/api/me", undefined, controller.signal)).toMatchObject({code:"CANCELLED"}); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("blocks foreign origins, category escapes and legacy rate method", async () => {
    const fetcher = vi.fn(); const client = new SmoobuClient({ ...options, allowWrites:true, writeCategories:["rates"], fetch:fetcher });
    expect(await client.request("https://evil.invalid/")).toMatchObject({code:"VALIDATION_ERROR"});
    expect(await client.mutate("POST", "/api/reservations/1/messages/send-message-to-guest",{})).toMatchObject({code:"WRITES_DISABLED"});
    expect(await client.mutate("PUT", "/api/rates",{})).toMatchObject({code:"UNSUPPORTED_OPERATION"}); expect(fetcher).not.toHaveBeenCalled();
  });
  it("allows only fixed availability POST while read-only", async () => {
    const fetcher = vi.fn().mockResolvedValue(json()); const client = new SmoobuClient({ ...options, fetch:fetcher });
    await client.checkAvailability({ customerId:1 }); expect(fetcher.mock.calls[0][0]).toBe("https://example.invalid/booking/checkApartmentAvailability");
    expect(await client.mutate("POST", "/booking/checkApartmentAvailability", {})).toMatchObject({code:"UNSUPPORTED_OPERATION"}); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

it("aborts a stalled fetch without replaying mutation", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {once:true})));
  const pending = new SmoobuClient({...options,allowWrites:true,fetch:fetcher,timeoutMs:100}).mutate("POST","/api/rates",{});
  await vi.advanceTimersByTimeAsync(100); expect(await pending).toMatchObject({code:"TIMEOUT"});expect(fetcher).toHaveBeenCalledTimes(1);
});

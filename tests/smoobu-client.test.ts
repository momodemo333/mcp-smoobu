import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SmoobuClient } from "../src/smoobu-client.js";

describe("SmoobuClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("signs read requests with Smoobu HMAC headers and sorted query params", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));
    vi.stubEnv("SMOOBU_API_KEY", "usr_live_test");
    vi.stubEnv("SMOOBU_API_SECRET", "secret_test");

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    const client = new SmoobuClient();
    await client.request("/api/reservations", { to: "2026-04-10", from: "2026-04-01" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/reservations");
    expect(init.method).toBe("GET");
    expect(init.headers["X-API-Key"]).toBe("usr_live_test");
    expect(init.headers["X-Timestamp"]).toBe("2026-04-01T12:00:00Z");
    expect(init.headers["X-Nonce"]).toMatch(/^[0-9a-f-]{36}$/);

    const bodyHash = createHash("sha256").update("").digest("hex");
    const canonical = [
      "GET",
      "/api/reservations",
      "from=2026-04-01&to=2026-04-10",
      "2026-04-01T12:00:00Z",
      init.headers["X-Nonce"],
      bodyHash,
      "usr_live_test",
    ].join("\n");
    const expected = createHmac("sha256", "secret_test").update(canonical).digest("base64");
    expect(init.headers["X-Signature"]).toBe(expected);
    expect(init.headers["Api-Key"]).toBeUndefined();
  });

  it("blocks write requests by default before touching the network", async () => {
    vi.stubEnv("SMOOBU_API_KEY", "usr_live_test");
    vi.stubEnv("SMOOBU_API_SECRET", "secret_test");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = new SmoobuClient();
    const result = await client.mutate("POST", "/api/reservations", { apartmentId: 1 });

    expect(result).toMatchObject({ error: true, code: "WRITES_DISABLED", status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { invalidResponse, mutationConfirmed } from "./response-validation.js";
import { createHmac, createHash, randomUUID } from "node:crypto";
import { createError, normalizeApiError, type NormalizedError } from "./errors.js";

export type WriteCategory = "rates" | "messages" | "reservations" | "price-elements";
type Params = Record<string, string | number | boolean | string[] | number[]>;
interface ClientOptions {
  apiKey?: string; apiSecret?: string; baseUrl?: string; allowWrites?: boolean;
  writeCategories?: WriteCategory[]; timeoutMs?: number; maxReadRetries?: number;
  fetch?: typeof fetch;
}

/** One process/account: 700/minute rolling window; other processes share the upstream quota. */
export class SmoobuClient {
  private readonly apiKey: string;
  private readonly apiSecret?: string;
  private readonly baseUrl: string;
  private readonly allowWrites: boolean;
  private readonly categories?: Set<string>;
  private readonly timeoutMs: number;
  private readonly maxReadRetries: number;
  private readonly fetcher: typeof fetch;
  private starts: number[] = [];
  private blockedUntil = 0;

  constructor(options: ClientOptions = {}) {
    const key = options.apiKey ?? process.env.SMOOBU_API_KEY;
    if (!key) throw new Error("SMOOBU_API_KEY environment variable is required.");
    this.apiKey = key;
    this.apiSecret = options.apiSecret ?? process.env.SMOOBU_API_SECRET;
    const base = new URL(options.baseUrl ?? process.env.SMOOBU_API_URL ?? "https://login.smoobu.com");
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/" ||
      (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)))) {
      throw new Error("SMOOBU_API_URL must be an HTTPS origin (HTTP loopback allowed for tests).");
    }
    this.baseUrl = base.origin;
    this.allowWrites = options.allowWrites ?? process.env.SMOOBU_ALLOW_WRITES === "true";
    const categories = options.writeCategories ?? process.env.SMOOBU_WRITE_CATEGORIES?.split(",").map(x => x.trim());
    if (categories) this.categories = new Set(categories);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxReadRetries = options.maxReadRetries ?? 2;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0 || !Number.isInteger(this.maxReadRetries) || this.maxReadRetries < 0 || this.maxReadRetries > 2) {
      throw new Error("Invalid client timeout or retry options.");
    }
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  capabilities() {
    const categories: WriteCategory[] = ["rates", "messages", "reservations", "price-elements"];
    return {
      authentication: this.apiSecret ? "hmac-sha256" : "legacy-api-key (documented sunset 2026-10-31)",
      writesEnabled: this.allowWrites,
      writeCategories: categories.filter(c => this.allowWrites && (!this.categories || this.categories.has(c))),
      rateLimitPerMinute: 700, timeoutMs: this.timeoutMs, maxReadRetries: this.maxReadRetries,
      mutationRetries: 0, availabilityCheckReadOnly: true,
      unsupported: ["mark-read", "no-reply-needed", "Airbnb requests/alterations", "guest CRUD", "generic online-check-in listing", "availability writes via rates"],
    };
  }

  request<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T | NormalizedError> {
    return this.send<T>("GET", path, undefined, params, true, signal);
  }

  /** Deliberately fixed path: no general POST write-gate bypass. */
  checkAvailability<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T | NormalizedError> {
    return this.send<T>("POST", "/booking/checkApartmentAvailability", body, undefined, true, signal);
  }

  mutate<T>(method: "POST" | "PUT" | "DELETE", path: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<T | NormalizedError> {
    const category = writeCategory(method, path);
    if (!category) return Promise.resolve(createError("UNSUPPORTED_OPERATION", 400, "Mutation endpoint/method is not supported by the documented public contract."));
    if (!this.allowWrites || (this.categories && !this.categories.has(category))) {
      return Promise.resolve(createError("WRITES_DISABLED", 403, "Write category disabled. SMOOBU_ALLOW_WRITES=true and any configured SMOOBU_WRITE_CATEGORIES must permit this action."));
    }
    return this.send<T>(method, path, body, undefined, false, signal);
  }

  private async send<T>(method: string, path: string, body: Record<string, unknown> | undefined, params: Params | undefined, readOnly: boolean, externalSignal?: AbortSignal): Promise<T | NormalizedError> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    externalSignal?.addEventListener("abort", abort, { once: true });
    if (externalSignal?.aborted) abort();
    const timer = setTimeout(abort, this.timeoutMs);
    try {
      const url = new URL(path, this.baseUrl);
      if (!path.startsWith("/") || path.startsWith("//") || url.origin !== this.baseUrl || url.username || url.password || url.hash) {
        return createError("VALIDATION_ERROR", 400, "Request path must stay on the configured API origin.");
      }
      for (const [key, value] of Object.entries(params ?? {})) {
        if (value == null) continue;
        if (Array.isArray(value)) for (const item of value) url.searchParams.append(key + "[]", String(item));
        else url.searchParams.set(key, String(value));
      }
      const bodyString = body === undefined ? undefined : JSON.stringify(body);
      for (let attempt = 0; ; attempt++) {
        await this.acquire(controller.signal);
        if (controller.signal.aborted) throw new Error("aborted");
        let response: Response;
        try {
          response = await this.fetcher(url.toString(), {
            method, headers: this.headers(method, url, bodyString), body: bodyString,
            signal: controller.signal, redirect: "error",
          });
        } catch {
          if (controller.signal.aborted) throw new Error("aborted");
          if (readOnly && attempt < this.maxReadRetries) { await sleep(250 * 2 ** attempt, controller.signal); continue; }
          return createError("API_ERROR", 0, readOnly ? "Unable to reach Smoobu API." : "Mutation outcome unknown: connection failed. Re-read state before any manual retry.");
        }
        const delay = retryDelay(response.headers);
        if (response.status === 429 || response.headers.get("X-RateLimit-Remaining") === "0") {
          this.blockedUntil = Math.max(this.blockedUntil, Date.now() + (delay ?? 1000));
        }
        // Consume within the same deadline; never echo untrusted body/credentials in errors.
        const text = await response.text();
        if (!response.ok) {
          if (readOnly && attempt < this.maxReadRetries && (response.status === 429 || response.status >= 500)) {
            await sleep(delay ?? 250 * 2 ** attempt, controller.signal); continue;
          }
          const error = normalizeApiError(response.status);
          if (!readOnly && response.status >= 500) error.message += " Mutation outcome unknown; re-read before retrying.";
          return error;
        }
        if (controller.signal.aborted) throw new Error("aborted");
        if (!text.trim() || response.status === 204) return invalidResponse(!readOnly, response.status);
        try {
          const parsed: unknown = JSON.parse(text);
          if (parsed === null || (!readOnly && !mutationConfirmed(method, path, parsed))) return invalidResponse(!readOnly, response.status);
          return parsed as T;
        }
        catch { return createError("INVALID_RESPONSE", response.status, readOnly ? "Smoobu returned invalid JSON." : "Mutation returned invalid JSON; outcome unknown. Re-read before retrying."); }
      }
    } catch {
      return createError(controller.signal.aborted ? (externalSignal?.aborted ? "CANCELLED" : "TIMEOUT") : "API_ERROR", controller.signal.aborted ? 408 : 0,
        (controller.signal.aborted ? "Request cancelled or deadline exceeded." : "Smoobu request failed.") + (!readOnly ? " Mutation outcome may be unknown; re-read before retrying." : ""));
    } finally { clearTimeout(timer); externalSignal?.removeEventListener("abort", abort); }
  }

  private async acquire(signal: AbortSignal) {
    for (;;) {
      if (signal.aborted) throw new Error("aborted");
      const now = Date.now();
      this.starts = this.starts.filter(t => t > now - 60_000);
      const wait = Math.max(this.blockedUntil - now, this.starts.length >= 700 ? this.starts[0] + 60_000 - now : 0);
      if (wait <= 0) { this.starts.push(now); return; }
      await sleep(wait, signal);
    }
  }

  private headers(method: string, url: URL, body?: string): Record<string, string> {
    const common = { Accept: "application/json", "User-Agent": "mcp-smoobu/0.1.1", ...(body === undefined ? {} : { "Content-Type": "application/json" }) };
    if (!this.apiSecret) return { "Api-Key": this.apiKey, ...common };
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const nonce = randomUUID();
    const canonical = [method, url.pathname, canonicalQuery(url), timestamp, nonce, createHash("sha256").update(body ?? "").digest("hex"), this.apiKey].join("\n");
    return { "X-API-Key": this.apiKey, "X-Timestamp": timestamp, "X-Nonce": nonce, "X-Signature": createHmac("sha256", this.apiSecret).update(canonical).digest("base64"), ...common };
  }
}

function writeCategory(method: string, path: string): WriteCategory | undefined {
  if (method === "POST" && path === "/api/rates") return "rates";
  if (method === "POST" && /^\/api\/reservations\/[1-9]\d*\/messages\/send-message-to-guest$/.test(path)) return "messages";
  if ((method === "POST" && /^\/api\/reservations\/[1-9]\d*\/price-elements(?:\/[1-9]\d*)?$/.test(path)) || (method === "DELETE" && /^\/api\/reservations\/[1-9]\d*\/price-elements\/[1-9]\d*$/.test(path))) return "price-elements";
  if ((method === "POST" && path === "/api/reservations") || (["PUT", "DELETE"].includes(method) && /^\/api\/reservations\/[1-9]\d*$/.test(path))) return "reservations";
}

const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
export function canonicalQuery(url: URL): string {
  return [...url.searchParams.entries()].sort(([a, av], [b, bv]) => a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0)
    .map(([k, v]) => rfc3986(k) + "=" + rfc3986(v)).join("&");
}
function retryDelay(headers: Headers): number | undefined {
  const raw = headers.get("Retry-After");
  const standard = raw === null ? NaN : /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw) - Date.now();
  const unix = headers.get("X-RateLimit-Retry-After");
  const vendor = unix === null ? NaN : Number(unix) * 1000 - Date.now();
  const valid = [standard, vendor].filter(Number.isFinite);
  return valid.length ? Math.max(0, ...valid) : undefined;
}
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const abort = () => { clearTimeout(timer); reject(new Error("aborted")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, Math.min(ms, 2_147_483_647));
    signal.addEventListener("abort", abort, { once: true });
  });
}
export function isError(value: unknown): value is NormalizedError {
  return typeof value === "object" && value !== null && "error" in value && (value as NormalizedError).error === true;
}

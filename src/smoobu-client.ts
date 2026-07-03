import { createHmac, createHash, randomUUID } from "node:crypto";
import { createError, normalizeApiError, type NormalizedError } from "./errors.js";

const DEFAULT_BASE_URL = "https://login.smoobu.com";
const TIMEOUT_MS = 30_000;

export class SmoobuClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret?: string;
  private version: string;
  private allowWrites: boolean;

  constructor() {
    const apiKey = process.env.SMOOBU_API_KEY;
    if (!apiKey) {
      throw new Error(
        "SMOOBU_API_KEY environment variable is required. " +
          "Get your API key from Smoobu Settings > API & Integrations.",
      );
    }
    this.apiKey = apiKey;
    this.apiSecret = process.env.SMOOBU_API_SECRET;
    this.baseUrl = (
      process.env.SMOOBU_API_URL || DEFAULT_BASE_URL
    ).replace(/\/$/, "");
    this.version = process.env.npm_package_version || "0.1.0";
    this.allowWrites = process.env.SMOOBU_ALLOW_WRITES === "true";
  }

  async request<T>(
    path: string,
    params?: Record<string, string | number | boolean | string[] | number[]>,
  ): Promise<T | NormalizedError> {
    const url = new URL(path, this.baseUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            url.searchParams.append(`${key}[]`, String(item));
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: this.headers("GET", url, undefined, {
          Accept: "application/json",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => undefined);
        return normalizeApiError(response.status, body);
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return createError(
          "TIMEOUT",
          408,
          "Request to Smoobu API timed out after 30 seconds.",
        );
      }
      return createError(
        "API_ERROR",
        0,
        `Failed to connect to Smoobu API: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async mutate<T>(
    method: "POST" | "PUT" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T | NormalizedError> {
    if (!this.allowWrites) {
      return createError(
        "WRITES_DISABLED",
        403,
        "Smoobu write operations are disabled. Set SMOOBU_ALLOW_WRITES=true only when you explicitly want to modify production data.",
      );
    }

    const url = new URL(path, this.baseUrl);
    const bodyString = body ? JSON.stringify(body) : undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: this.headers(method, url, bodyString, {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        }),
        body: bodyString,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => undefined);
        return normalizeApiError(response.status, text);
      }

      if (response.status === 204) return {} as T;
      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return createError(
          "TIMEOUT",
          408,
          "Request to Smoobu API timed out after 30 seconds.",
        );
      }
      return createError(
        "API_ERROR",
        0,
        `Failed to connect to Smoobu API: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private headers(
    method: string,
    url: URL,
    body: string | undefined,
    extra: Record<string, string>,
  ): Record<string, string> {
    const common = {
      "User-Agent": `mcp-smoobu/${this.version}`,
      ...extra,
    };

    if (!this.apiSecret) {
      return {
        "Api-Key": this.apiKey,
        ...common,
      };
    }

    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const nonce = randomUUID();
    const signature = this.sign(method, url.pathname, canonicalQuery(url), timestamp, nonce, body ?? "");

    return {
      "X-API-Key": this.apiKey,
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
      "X-Signature": signature,
      ...common,
    };
  }

  private sign(
    method: string,
    path: string,
    query: string,
    timestamp: string,
    nonce: string,
    body: string,
  ): string {
    const bodyHash = createHash("sha256").update(body).digest("hex");
    const canonical = [
      method.toUpperCase(),
      path,
      query,
      timestamp,
      nonce,
      bodyHash,
      this.apiKey,
    ].join("\n");

    return createHmac("sha256", this.apiSecret ?? "")
      .update(canonical)
      .digest("base64");
  }
}

function canonicalQuery(url: URL): string {
  return [...url.searchParams.entries()]
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

/** Helper to check if a response is an error */
export function isError(value: unknown): value is NormalizedError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    (value as NormalizedError).error === true
  );
}

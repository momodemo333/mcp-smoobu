import { createError, normalizeApiError, type NormalizedError } from "./errors.js";

const DEFAULT_BASE_URL = "https://login.smoobu.com";
const TIMEOUT_MS = 30_000;

export class SmoobuClient {
  private baseUrl: string;
  private apiKey: string;
  private version: string;

  constructor() {
    const apiKey = process.env.SMOOBU_API_KEY;
    if (!apiKey) {
      throw new Error(
        "SMOOBU_API_KEY environment variable is required. " +
          "Get your API key from Smoobu Settings > API & Integrations.",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (
      process.env.SMOOBU_API_URL || DEFAULT_BASE_URL
    ).replace(/\/$/, "");
    this.version = process.env.npm_package_version || "0.1.0";
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
        headers: {
          "Api-Key": this.apiKey,
          "User-Agent": `mcp-smoobu/${this.version}`,
          Accept: "application/json",
        },
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
    const url = new URL(path, this.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          "Api-Key": this.apiKey,
          "User-Agent": `mcp-smoobu/${this.version}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
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

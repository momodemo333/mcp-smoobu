export type ErrorCode = "MISSING_API_KEY" | "INVALID_API_KEY" | "NOT_FOUND" | "RATE_LIMIT" | "VALIDATION_ERROR" | "WRITES_DISABLED" | "API_ERROR" | "TIMEOUT" | "CANCELLED" | "INVALID_RESPONSE" | "UNSUPPORTED_OPERATION";
export interface NormalizedError { error: true; status: number; message: string; code: ErrorCode; }
export function createError(code: ErrorCode, status: number, message: string): NormalizedError { return { error: true, status, message, code }; }
/** Never echo server bodies: they may contain credentials or guest data. */
export function normalizeApiError(status: number, _body?: string): NormalizedError {
  if (status === 401 || status === 403) return createError("INVALID_API_KEY", status, "Authentication/authorization failed; verify key, signature, permissions and clock.");
  if (status === 404) return createError("NOT_FOUND", status, "Resource not found or not visible to this key.");
  if (status === 429) return createError("RATE_LIMIT", status, "Smoobu allows 700 requests/minute. Retry only after the rate-limit window.");
  return createError("API_ERROR", status, "Smoobu API returned status " + status + ".");
}

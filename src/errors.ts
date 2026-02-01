export type ErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "VALIDATION_ERROR"
  | "API_ERROR"
  | "TIMEOUT";

export interface NormalizedError {
  error: true;
  status: number;
  message: string;
  code: ErrorCode;
}

export function createError(
  code: ErrorCode,
  status: number,
  message: string,
): NormalizedError {
  return { error: true, status, message, code };
}

export function normalizeApiError(
  status: number,
  body?: string,
): NormalizedError {
  switch (status) {
    case 401:
      return createError(
        "INVALID_API_KEY",
        401,
        "Invalid API key. Check your SMOOBU_API_KEY environment variable.",
      );
    case 404:
      return createError(
        "NOT_FOUND",
        404,
        "Resource not found. Verify the ID is correct.",
      );
    case 429:
      return createError(
        "RATE_LIMIT",
        429,
        "Rate limit exceeded. Smoobu allows 1000 requests per minute. Wait before retrying.",
      );
    default:
      if (status >= 500) {
        return createError(
          "API_ERROR",
          status,
          `Smoobu API error (${status}). Try again later.`,
        );
      }
      return createError(
        "API_ERROR",
        status,
        `Smoobu API returned status ${status}${body ? `: ${body.substring(0, 200)}` : ""}`,
      );
  }
}

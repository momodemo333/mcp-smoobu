import { createError, type NormalizedError } from "./errors.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateRequired(
  params: Record<string, unknown>,
  required: string[],
): NormalizedError | null {
  for (const name of required) {
    if (params[name] === undefined || params[name] === null) {
      return createError(
        "VALIDATION_ERROR",
        400,
        `Missing required parameter: ${name}`,
      );
    }
  }
  return null;
}

export function validatePositiveInt(
  value: unknown,
  name: string,
): NormalizedError | null {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `${name} must be a positive integer. Received: ${value}`,
    );
  }
  return null;
}

export function validateDate(
  value: unknown,
  name: string,
): NormalizedError | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !DATE_REGEX.test(value)) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `${name} must be a date in YYYY-MM-DD format. Received: ${value}`,
    );
  }
  return null;
}

export function validatePageSize(value: unknown): NormalizedError | null {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 100) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `pageSize must be between 1 and 100. Received: ${value}`,
    );
  }
  return null;
}

export function validateDateRange(
  startDate: string,
  endDate: string,
  maxDays: number,
): NormalizedError | null {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `endDate (${endDate}) must be after startDate (${startDate})`,
    );
  }
  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > maxDays) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `Date range exceeds maximum of ${maxDays} days. Requested: ${Math.ceil(diffDays)} days.`,
    );
  }
  return null;
}

export function validateNumberArray(
  value: unknown,
  name: string,
): NormalizedError | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `${name} must be an array of numbers. Received: ${typeof value}`,
    );
  }
  for (const item of value) {
    const num = Number(item);
    if (!Number.isInteger(num) || num < 1) {
      return createError(
        "VALIDATION_ERROR",
        400,
        `${name} must contain only positive integers. Found: ${item}`,
      );
    }
  }
  return null;
}

export function validateFutureDate(
  value: unknown,
  name: string,
): NormalizedError | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !DATE_REGEX.test(value)) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `${name} must be a date in YYYY-MM-DD format. Received: ${value}`,
    );
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(value + "T00:00:00");
  if (date < today) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `${name} must be today or in the future. Received: ${value}`,
    );
  }
  return null;
}

export function validateArrivalBeforeDeparture(
  arrival: string,
  departure: string,
): NormalizedError | null {
  const a = new Date(arrival);
  const d = new Date(departure);
  if (d <= a) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `departureDate (${departure}) must be after arrivalDate (${arrival})`,
    );
  }
  return null;
}

export function validateEmail(
  value: unknown,
  name: string,
): NormalizedError | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `${name} must be a valid email address. Received: ${value}`,
    );
  }
  return null;
}

export function validateTimeFormat(
  value: unknown,
  name: string,
): NormalizedError | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `${name} must be in HH:MM format. Received: ${value}`,
    );
  }
  return null;
}

export function validateEnum(
  value: unknown,
  name: string,
  allowed: string[],
): NormalizedError | null {
  if (value === undefined || value === null) return null;
  if (!allowed.includes(String(value))) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `${name} must be one of: ${allowed.join(", ")}. Received: ${value}`,
    );
  }
  return null;
}

export function validateNonNegativeNumber(
  value: unknown,
  name: string,
): NormalizedError | null {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    return createError(
      "VALIDATION_ERROR",
      400,
      `${name} must be a non-negative number. Received: ${value}`,
    );
  }
  return null;
}

/** Run multiple validators, return first error or null */
export function validate(
  ...results: (NormalizedError | null)[]
): NormalizedError | null {
  for (const result of results) {
    if (result) return result;
  }
  return null;
}

import { describe, it, expect } from "vitest";
import {
  validate,
  validateRequired,
  validatePositiveInt,
  validateDate,
  validatePageSize,
  validateDateRange,
  validateNumberArray,
  validateFutureDate,
  validateArrivalBeforeDeparture,
  validateEmail,
  validateTimeFormat,
  validateEnum,
  validateNonNegativeNumber,
} from "../src/validation.js";

describe("validateRequired", () => {
  it("returns null when all required params are present", () => {
    expect(validateRequired({ a: 1, b: "x" }, ["a", "b"])).toBeNull();
  });

  it("returns error when a required param is missing", () => {
    const result = validateRequired({ a: 1 }, ["a", "b"]);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("VALIDATION_ERROR");
    expect(result!.message).toContain("b");
  });

  it("returns error when a required param is null", () => {
    const result = validateRequired({ a: null }, ["a"]);
    expect(result).not.toBeNull();
  });
});

describe("validatePositiveInt", () => {
  it("returns null for positive integers", () => {
    expect(validatePositiveInt(1, "x")).toBeNull();
    expect(validatePositiveInt(100, "x")).toBeNull();
  });

  it("returns null for undefined/null", () => {
    expect(validatePositiveInt(undefined, "x")).toBeNull();
    expect(validatePositiveInt(null, "x")).toBeNull();
  });

  it("returns error for zero", () => {
    expect(validatePositiveInt(0, "x")).not.toBeNull();
  });

  it("returns error for negative", () => {
    expect(validatePositiveInt(-1, "x")).not.toBeNull();
  });

  it("returns error for float", () => {
    expect(validatePositiveInt(1.5, "x")).not.toBeNull();
  });
});

describe("validateDate", () => {
  it("returns null for valid date", () => {
    expect(validateDate("2025-01-15", "x")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(validateDate(undefined, "x")).toBeNull();
  });

  it("returns error for invalid format", () => {
    expect(validateDate("01-15-2025", "x")).not.toBeNull();
    expect(validateDate("2025/01/15", "x")).not.toBeNull();
    expect(validateDate("not-a-date", "x")).not.toBeNull();
  });
});

describe("validatePageSize", () => {
  it("returns null for valid page sizes", () => {
    expect(validatePageSize(1)).toBeNull();
    expect(validatePageSize(50)).toBeNull();
    expect(validatePageSize(100)).toBeNull();
  });

  it("returns error for out of range", () => {
    expect(validatePageSize(0)).not.toBeNull();
    expect(validatePageSize(101)).not.toBeNull();
  });
});

describe("validateDateRange", () => {
  it("returns null for valid range", () => {
    expect(validateDateRange("2025-01-01", "2025-01-10", 365)).toBeNull();
  });

  it("returns error when end before start", () => {
    expect(validateDateRange("2025-01-10", "2025-01-01", 365)).not.toBeNull();
  });

  it("returns error when range exceeds max", () => {
    expect(validateDateRange("2025-01-01", "2026-06-01", 365)).not.toBeNull();
  });
});

describe("validateNumberArray", () => {
  it("returns null for valid arrays", () => {
    expect(validateNumberArray([1, 2, 3], "x")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(validateNumberArray(undefined, "x")).toBeNull();
  });

  it("returns error for non-array", () => {
    expect(validateNumberArray("not-array", "x")).not.toBeNull();
  });

  it("returns error for array with non-positive ints", () => {
    expect(validateNumberArray([1, -1], "x")).not.toBeNull();
    expect(validateNumberArray([0], "x")).not.toBeNull();
  });
});

describe("validateFutureDate", () => {
  it("returns null for undefined", () => {
    expect(validateFutureDate(undefined, "x")).toBeNull();
  });

  it("returns error for invalid format", () => {
    expect(validateFutureDate("not-a-date", "x")).not.toBeNull();
  });

  it("returns null for today", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(validateFutureDate(today, "x")).toBeNull();
  });

  it("returns null for future date", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(validateFutureDate(future.toISOString().split("T")[0], "x")).toBeNull();
  });

  it("returns error for past date", () => {
    expect(validateFutureDate("2020-01-01", "x")).not.toBeNull();
  });
});

describe("validateArrivalBeforeDeparture", () => {
  it("returns null when departure is after arrival", () => {
    expect(validateArrivalBeforeDeparture("2025-01-01", "2025-01-05")).toBeNull();
  });

  it("returns error when departure equals arrival", () => {
    expect(validateArrivalBeforeDeparture("2025-01-01", "2025-01-01")).not.toBeNull();
  });

  it("returns error when departure is before arrival", () => {
    expect(validateArrivalBeforeDeparture("2025-01-05", "2025-01-01")).not.toBeNull();
  });
});

describe("validateEmail", () => {
  it("returns null for undefined", () => {
    expect(validateEmail(undefined, "x")).toBeNull();
  });

  it("returns null for valid emails", () => {
    expect(validateEmail("test@example.com", "x")).toBeNull();
    expect(validateEmail("user+tag@domain.co.uk", "x")).toBeNull();
  });

  it("returns error for invalid emails", () => {
    expect(validateEmail("not-an-email", "x")).not.toBeNull();
    expect(validateEmail("@domain.com", "x")).not.toBeNull();
    expect(validateEmail("user@", "x")).not.toBeNull();
  });
});

describe("validateTimeFormat", () => {
  it("returns null for undefined", () => {
    expect(validateTimeFormat(undefined, "x")).toBeNull();
  });

  it("returns null for valid times", () => {
    expect(validateTimeFormat("14:00", "x")).toBeNull();
    expect(validateTimeFormat("09:30", "x")).toBeNull();
  });

  it("returns error for invalid formats", () => {
    expect(validateTimeFormat("2:00", "x")).not.toBeNull();
    expect(validateTimeFormat("14:00:00", "x")).not.toBeNull();
    expect(validateTimeFormat("not-time", "x")).not.toBeNull();
  });
});

describe("validateEnum", () => {
  it("returns null for undefined", () => {
    expect(validateEnum(undefined, "x", ["a", "b"])).toBeNull();
  });

  it("returns null for valid value", () => {
    expect(validateEnum("a", "x", ["a", "b"])).toBeNull();
  });

  it("returns error for invalid value", () => {
    const result = validateEnum("c", "x", ["a", "b"]);
    expect(result).not.toBeNull();
    expect(result!.message).toContain("a, b");
  });
});

describe("validateNonNegativeNumber", () => {
  it("returns null for undefined", () => {
    expect(validateNonNegativeNumber(undefined, "x")).toBeNull();
  });

  it("returns null for zero and positive", () => {
    expect(validateNonNegativeNumber(0, "x")).toBeNull();
    expect(validateNonNegativeNumber(100.5, "x")).toBeNull();
  });

  it("returns error for negative", () => {
    expect(validateNonNegativeNumber(-1, "x")).not.toBeNull();
  });

  it("returns error for NaN", () => {
    expect(validateNonNegativeNumber("abc", "x")).not.toBeNull();
  });
});

describe("validate (combiner)", () => {
  it("returns null when all pass", () => {
    expect(validate(null, null, null)).toBeNull();
  });

  it("returns first error", () => {
    const err1 = validatePositiveInt(-1, "a");
    const err2 = validatePositiveInt(-2, "b");
    const result = validate(null, err1, err2);
    expect(result).toBe(err1);
  });
});

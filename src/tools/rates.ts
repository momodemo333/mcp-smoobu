import { z } from "zod";
import { isError, type SmoobuClient } from "../smoobu-client.js";
import { createError } from "../errors.js";
import type { SmoobuUser, SmoobuRatesResponse } from "../types.js";
import { validate, validateDate, validateDateRange, validateNumberArray, validatePositiveInt, validateRequired, validateArrivalBeforeDeparture } from "../validation.js";

const dateSpec = z.string().refine(value => {
  const parts = value.split(":");
  return parts.length <= 2 && parts.every(d => !validateDate(d, "date")) && !validateDateRange(parts[0], parts[1] ?? parts[0], 365);
}, "Expected real YYYY-MM-DD date or ordered range of at most 365 days");
export const ratesSchema = z.strictObject({
  apartments: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).min(1).max(100),
  operations: z.array(z.strictObject({
    dates: z.array(dateSpec).min(1).max(366),
    daily_price: z.number().finite().nonnegative().optional(),
    min_length_of_stay: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  }).refine(op => op.daily_price !== undefined || op.min_length_of_stay !== undefined, "Each operation needs daily_price or min_length_of_stay")).min(1).max(100),
});

export async function listRates(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = validate(validateRequired(params, ["startDate", "endDate", "apartments"]), validateDate(params.startDate, "startDate"), validateDate(params.endDate, "endDate"), validateNumberArray(params.apartments, "apartments"),
    params.startDate && params.endDate ? validateDateRange(params.startDate as string, params.endDate as string, 365) : null);
  if (error) return error;
  if (!(params.apartments as number[]).length) return createError("VALIDATION_ERROR", 400, "apartments must not be empty.");
  return client.request<SmoobuRatesResponse>("/api/rates", { start_date: params.startDate as string, end_date: params.endDate as string, apartments: params.apartments as number[] }, ...signal ? [signal] as [AbortSignal] : []);
}

export async function checkApartmentAvailability(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = validate(validateRequired(params, ["apartmentId", "arrivalDate", "departureDate"]), validatePositiveInt(params.apartmentId, "apartmentId"), validateDate(params.arrivalDate, "arrivalDate"), validateDate(params.departureDate, "departureDate"),
    params.arrivalDate && params.departureDate ? validateArrivalBeforeDeparture(params.arrivalDate as string, params.departureDate as string) : null);
  if (error) return error;
  const user = await client.request<SmoobuUser>("/api/me", ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]);
  if (isError(user)) return user;
  if (!user || validateRequired(user as unknown as Record<string, unknown>, ["id"]) || validatePositiveInt(user.id, "customerId")) return createError("INVALID_RESPONSE", 502, "User response lacks a valid customerId.");
  return client.checkAvailability<Record<string, unknown>>({ arrivalDate: params.arrivalDate, departureDate: params.departureDate, apartments: [params.apartmentId], customerId: user.id }, ...signal ? [signal] as [AbortSignal] : []);
}

/** Pure: no network, no authorization to apply, no existing-state snapshot. */
export function previewRates(params: Record<string, unknown>) {
  const parsed = ratesSchema.safeParse(params);
  if (!parsed.success) return createError("VALIDATION_ERROR", 400, "Use apartments:[IDs], operations:[{dates,daily_price?,min_length_of_stay?}]. Legacy priceItems/price/available are not supported. " + parsed.error.issues.map(i => i.path.join(".") + ": " + i.message).join("; "));
  const seen = new Set<string>();
  for (const op of parsed.data.operations) {
    for (const spec of op.dates) {
      const [start, end = start] = spec.split(":");
      for (let t = Date.parse(start); t <= Date.parse(end); t += 86_400_000) {
        const date = new Date(t).toISOString().slice(0, 10);
        if (seen.has(date)) return createError("VALIDATION_ERROR", 400, "Overlapping date operations are ambiguous: " + date);
        seen.add(date);
      }
    }
  }
  if (new Set(parsed.data.apartments).size !== parsed.data.apartments.length) return createError("VALIDATION_ERROR", 400, "Duplicate apartment IDs are not allowed.");
  if (seen.size * parsed.data.apartments.length > 36600) return createError("VALIDATION_ERROR", 400, "Local safety cap: 36600 apartment-days per update.");
  return { method: "POST" as const, path: "/api/rates", payload: parsed.data, affectedDaysPerApartment: seen.size,
    warnings: ["Preview only; no current-price snapshot or concurrency guarantee.", "Minimum-stay-only updates require an existing price.", "Rates may propagate to price-sync-enabled channels; no availability changes are supported."] };
}
export async function updateRates(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const plan = previewRates(params);
  if (isError(plan)) return plan;
  return client.mutate<Record<string, unknown>>("POST", "/api/rates", plan.payload, ...signal ? [signal] as [AbortSignal] : []);
}

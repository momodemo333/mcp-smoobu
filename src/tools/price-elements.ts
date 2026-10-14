import type { SmoobuClient } from "../smoobu-client.js";
import { createError } from "../errors.js";
import { createPriceElementSchema, updatePriceElementSchema } from "../write-schemas.js";
import { validate, validatePositiveInt, validateRequired } from "../validation.js";
export async function createPriceElement(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const parsed = createPriceElementSchema.safeParse(params);
  if (!parsed.success) return createError("VALIDATION_ERROR", 400, "Price element requires reservationId, nonblank name, amount >= 0, currencyCode (AAA) and documented optional fields.");
  const { reservationId, ...body } = parsed.data;
  return client.mutate<Record<string, unknown>>("POST", "/api/reservations/" + reservationId + "/price-elements", body, ...signal ? [signal] as [AbortSignal] : []);
}
export async function updatePriceElement(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const parsed = updatePriceElementSchema.safeParse(params);
  if (!parsed.success) return createError("VALIDATION_ERROR", 400, "Price element update requires reservationId, elementId, name, amount and currencyCode; partial updates are not documented.");
  const { reservationId, elementId, ...body } = parsed.data;
  return client.mutate<Record<string, unknown>>("POST", "/api/reservations/" + reservationId + "/price-elements/" + elementId, body, ...signal ? [signal] as [AbortSignal] : []);
}
function ids(params: Record<string, unknown>) { return validate(validateRequired(params, ["reservationId", "elementId"]), validatePositiveInt(params.reservationId, "reservationId"), validatePositiveInt(params.elementId, "elementId")); }
export async function getPriceElement(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = ids(params); if (error) return error;
  return client.request<Record<string, unknown>>("/api/reservations/" + params.reservationId + "/price-elements/" + params.elementId, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]);
}
export async function deletePriceElement(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = ids(params); if (error) return error;
  return client.mutate<Record<string, unknown>>("DELETE", "/api/reservations/" + params.reservationId + "/price-elements/" + params.elementId, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]);
}

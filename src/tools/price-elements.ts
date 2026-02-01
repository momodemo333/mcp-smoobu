import type { SmoobuClient } from "../smoobu-client.js";
import type { SmoobuPriceElement } from "../types.js";
import {
  validate,
  validateNonNegativeNumber,
  validatePositiveInt,
  validateRequired,
} from "../validation.js";

export async function createPriceElement(
  client: SmoobuClient,
  params: Record<string, unknown>,
) {
  const error = validate(
    validateRequired(params, ["reservationId", "name", "amount"]),
    validatePositiveInt(params.reservationId, "reservationId"),
    validateNonNegativeNumber(params.amount, "amount"),
    params.quantity !== undefined ? validatePositiveInt(params.quantity, "quantity") : null,
    params.tax !== undefined ? validateNonNegativeNumber(params.tax, "tax") : null,
  );
  if (error) return error;

  const payload: Record<string, unknown> = {
    name: params.name,
    amount: Number(params.amount),
  };

  const optionalFields = ["type", "quantity", "tax", "currencyCode", "sortOrder", "priceIncludedInId"];
  for (const field of optionalFields) {
    if (params[field] !== undefined) {
      payload[field] = params[field];
    }
  }

  return client.mutate<SmoobuPriceElement>(
    "POST",
    `/api/reservations/${params.reservationId}/price-elements`,
    payload,
  );
}

export async function updatePriceElement(
  client: SmoobuClient,
  params: Record<string, unknown>,
) {
  const error = validate(
    validateRequired(params, ["reservationId", "elementId"]),
    validatePositiveInt(params.reservationId, "reservationId"),
    validatePositiveInt(params.elementId, "elementId"),
    params.amount !== undefined ? validateNonNegativeNumber(params.amount, "amount") : null,
    params.quantity !== undefined ? validatePositiveInt(params.quantity, "quantity") : null,
    params.tax !== undefined ? validateNonNegativeNumber(params.tax, "tax") : null,
  );
  if (error) return error;

  const payload: Record<string, unknown> = {};
  const modifiableFields = ["name", "amount", "type", "quantity", "tax", "currencyCode", "sortOrder", "priceIncludedInId"];
  for (const field of modifiableFields) {
    if (params[field] !== undefined) {
      payload[field] = params[field];
    }
  }

  if (Object.keys(payload).length === 0) {
    return validate(validateRequired({}, ["at least one field to update"]));
  }

  return client.mutate<SmoobuPriceElement>(
    "POST",
    `/api/reservations/${params.reservationId}/price-elements/${params.elementId}`,
    payload,
  );
}

export async function deletePriceElement(
  client: SmoobuClient,
  params: Record<string, unknown>,
) {
  const error = validate(
    validateRequired(params, ["reservationId", "elementId"]),
    validatePositiveInt(params.reservationId, "reservationId"),
    validatePositiveInt(params.elementId, "elementId"),
  );
  if (error) return error;

  return client.mutate<Record<string, unknown>>(
    "DELETE",
    `/api/reservations/${params.reservationId}/price-elements/${params.elementId}`,
  );
}

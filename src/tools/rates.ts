import type { SmoobuClient } from "../smoobu-client.js";
import type { SmoobuRateDay } from "../types.js";
import {
  validate,
  validateDate,
  validateDateRange,
  validateNumberArray,
  validatePositiveInt,
  validateRequired,
  validateArrivalBeforeDeparture,
  validateNonNegativeNumber,
} from "../validation.js";

export const listRatesTool = {
  name: "list_rates",
  description:
    "Get daily rates and availability for properties over a date range. " +
    "Returns price, minimum stay, and availability per day per property. " +
    "Maximum date range: 365 days. Use apartments filter to limit to specific properties. " +
    "Dates must be in YYYY-MM-DD format. " +
    "Smoobu API rate limit: 1000 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      startDate: { type: "string", description: "Start date (YYYY-MM-DD, required)" },
      endDate: { type: "string", description: "End date (YYYY-MM-DD, required)" },
      apartments: {
        type: "array",
        items: { type: "number" },
        description: "Filter by apartment IDs (optional)",
      },
    },
    required: ["startDate", "endDate"],
  },
};

export async function listRates(client: SmoobuClient, params: Record<string, unknown>) {
  const error = validate(
    validateRequired(params, ["startDate", "endDate"]),
    validateDate(params.startDate, "startDate"),
    validateDate(params.endDate, "endDate"),
    validateNumberArray(params.apartments, "apartments"),
    params.startDate && params.endDate
      ? validateDateRange(params.startDate as string, params.endDate as string, 365)
      : null,
  );
  if (error) return error;

  const apiParams: Record<string, string | number[]> = {
    start_date: params.startDate as string,
    end_date: params.endDate as string,
  };
  if (params.apartments) apiParams.apartments = params.apartments as number[];

  return client.request<Record<string, Record<string, SmoobuRateDay>>>(
    "/api/rates",
    apiParams,
  );
}

export async function checkApartmentAvailability(
  client: SmoobuClient,
  params: Record<string, unknown>,
) {
  const error = validate(
    validateRequired(params, ["apartmentId", "arrivalDate", "departureDate"]),
    validatePositiveInt(params.apartmentId, "apartmentId"),
    validateDate(params.arrivalDate, "arrivalDate"),
    validateDate(params.departureDate, "departureDate"),
    params.arrivalDate && params.departureDate
      ? validateArrivalBeforeDeparture(
          params.arrivalDate as string,
          params.departureDate as string,
        )
      : null,
  );
  if (error) return error;

  return client.mutate<Record<string, unknown>>(
    "POST",
    "/booking/checkApartmentAvailability",
    {
      arrivalDate: params.arrivalDate,
      departureDate: params.departureDate,
      apartments: [Number(params.apartmentId)],
      customerId: 0,
    },
  );
}

export async function updateRates(
  client: SmoobuClient,
  params: Record<string, unknown>,
) {
  const error = validate(
    validateRequired(params, ["apartments"]),
  );
  if (error) return error;

  const apartments = params.apartments as Array<Record<string, unknown>>;
  if (!Array.isArray(apartments) || apartments.length === 0) {
    return validate(
      validateRequired({}, ["apartments"]),
    );
  }

  for (const apt of apartments) {
    const aptError = validate(
      validateRequired(apt, ["id"]),
      validatePositiveInt(apt.id, "apartments[].id"),
    );
    if (aptError) return aptError;

    if (apt.priceItems && Array.isArray(apt.priceItems)) {
      for (const item of apt.priceItems as Array<Record<string, unknown>>) {
        const itemError = validate(
          validateRequired(item, ["date"]),
          validateDate(item.date, "priceItems[].date"),
          item.price !== undefined ? validateNonNegativeNumber(item.price, "priceItems[].price") : null,
          item.min_length_of_stay !== undefined ? validatePositiveInt(item.min_length_of_stay, "priceItems[].min_length_of_stay") : null,
        );
        if (itemError) return itemError;
      }
    }
  }

  return client.mutate<Record<string, unknown>>(
    "PUT",
    "/api/rates",
    { apartments },
  );
}

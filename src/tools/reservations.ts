import { validPage, invalidResponse } from "../response-validation.js";
import { createError } from "../errors.js";
import { createReservationSchema, updateReservationSchema } from "../write-schemas.js";
import { isError, type SmoobuClient } from "../smoobu-client.js";
import type {
  SmoobuPaginatedResponse,
  SmoobuPriceElement,
  SmoobuPlaceholder,
  SmoobuReservation,
  SimplifiedReservation,
} from "../types.js";
import {
  validate,
  validateArrivalBeforeDeparture,
  validateDate,
  validateDateRange,
  validateEmail,
  validateNonNegativeNumber,
  validatePageSize,
  validatePositiveInt,
  validateRequired,
  validateTimeFormat,
} from "../validation.js";

export const listReservationsTool = {
  name: "list_reservations",
  description:
    "List reservations with optional filters. IMPORTANT: Always use date filters to limit results. " +
    "If no date filter is provided, defaults to arrivals from 30 days ago to 90 days ahead. " +
    "Use page and pageSize for pagination (max 100 per page). " +
    "Response includes totalItems to know the full count. " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      arrivalFrom: { type: "string", description: "Filter arrivals from this date (YYYY-MM-DD)" },
      arrivalTo: { type: "string", description: "Filter arrivals until this date (YYYY-MM-DD)" },
      departureFrom: { type: "string", description: "Filter departures from this date (YYYY-MM-DD)" },
      departureTo: { type: "string", description: "Filter departures until this date (YYYY-MM-DD)" },
      createdFrom: { type: "string", description: "Filter by creation date from (YYYY-MM-DD)" },
      createdTo: { type: "string", description: "Filter by creation date until (YYYY-MM-DD)" },
      modifiedFrom: { type: "string", description: "Filter by modification date from (YYYY-MM-DD)" },
      modifiedTo: { type: "string", description: "Filter by modification date until (YYYY-MM-DD)" },
      apartmentId: { type: "number", description: "Filter by property ID" },
      showCancellation: { type: "boolean", description: "Include cancelled bookings (default: false)" },
      excludeBlocked: { type: "boolean", description: "Exclude blocked periods (default: false)" },
      includeRelated: { type: "boolean", description: "Include related bookings (default: false)" },
      includePriceElements: { type: "boolean", description: "Include price breakdown (default: false)" },
      page: { type: "number", description: "Page number (default: 1)" },
      pageSize: { type: "number", description: "Results per page (1-100, default: 25)" },
    },
    required: [],
  },
};

export const getReservationTool = {
  name: "get_reservation",
  description:
    "Get full details of a specific reservation by ID, including guest contact info, " +
    "prices, check-in/out times, and notices. Use list_reservations first to find reservation IDs. " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      reservationId: {
        type: "number",
        description: "The Smoobu reservation ID (positive integer)",
      },
    },
    required: ["reservationId"],
  },
};

export const getReservationPriceElementsTool = {
  name: "get_reservation_price_elements",
  description:
    "Get the price breakdown of a reservation (accommodation, extras, taxes, etc.). " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      reservationId: {
        type: "number",
        description: "The Smoobu reservation ID (positive integer)",
      },
    },
    required: ["reservationId"],
  },
};

export const getReservationPlaceholdersTool = {
  name: "get_reservation_placeholders",
  description:
    "Get placeholder key-value pairs for a reservation (used in message templates). " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      reservationId: {
        type: "number",
        description: "The Smoobu reservation ID (positive integer)",
      },
    },
    required: ["reservationId"],
  },
};

function simplifyReservation(r: SmoobuReservation): SimplifiedReservation {
  return {
    id: r.id,
    referenceId: r["reference-id"],
    type: r.type,
    arrival: r.arrival,
    departure: r.departure,
    apartmentId: r.apartment.id,
    apartmentName: r.apartment.name,
    channel: r.channel?.name ?? "unknown",
    guestName: r["guest-name"],
    adults: r.adults,
    children: r.children,
    price: r.price,
    isBlocked: r["is-blocked-booking"],
  };
}

function applyDefaultDateFilters(params: Record<string, unknown>): Record<string, unknown> {
  const hasDateFilter = [
    "arrivalFrom", "arrivalTo",
    "departureFrom", "departureTo",
    "createdFrom", "createdTo",
    "modifiedFrom", "modifiedTo",
  ].some((key) => params[key] !== undefined && params[key] !== null);

  if (hasDateFilter) return params;

  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const to = new Date(today);
  to.setDate(to.getDate() + 90);

  return {
    ...params,
    arrivalFrom: from.toISOString().split("T")[0],
    arrivalTo: to.toISOString().split("T")[0],
  };
}

export async function listReservations(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const dateFields = [
    "arrivalFrom", "arrivalTo", "departureFrom", "departureTo",
    "createdFrom", "createdTo", "modifiedFrom", "modifiedTo",
  ];
  const error = validate(
    ...dateFields.map((f) => validateDate(params[f], f)),
    ...["arrival", "departure", "created", "modified"].map(prefix => params[prefix + "From"] && params[prefix + "To"] ? validateDateRange(params[prefix + "From"] as string, params[prefix + "To"] as string, Infinity) : null),
    validatePositiveInt(params.apartmentId, "apartmentId"),
    validatePositiveInt(params.page, "page"),
    validatePageSize(params.pageSize),
  );
  if (error) return error;

  const safeParams = applyDefaultDateFilters(params);

  const apiParams: Record<string, string | number | boolean> = { page: 1, pageSize: 25 };
  const paramMap: Record<string, string> = {
    arrivalFrom: "arrivalFrom",
    arrivalTo: "arrivalTo",
    departureFrom: "departureFrom",
    departureTo: "departureTo",
    createdFrom: "created_from",
    createdTo: "created_to",
    modifiedFrom: "modifiedFrom",
    modifiedTo: "modifiedTo",
    apartmentId: "apartmentId",
    showCancellation: "showCancellation",
    excludeBlocked: "excludeBlocked",
    includeRelated: "includeRelated",
    includePriceElements: "includePriceElements",
    page: "page",
    pageSize: "pageSize",
  };

  for (const [input, api] of Object.entries(paramMap)) {
    if (safeParams[input] !== undefined && safeParams[input] !== null) {
      apiParams[api] = safeParams[input] as string | number | boolean;
    }
  }

  const result = await client.request<SmoobuPaginatedResponse<SmoobuReservation>>(
    "/api/reservations",
    apiParams, ...signal ? [signal] as [AbortSignal] : []
  );

  if (isError(result)) return result;

  if (!validPage(result, "bookings")) return invalidResponse();
  const bookings = (result.bookings as SmoobuReservation[]) || [];

  return {
    totalItems: result.total_items,
    page: result.page,
    pageSize: result.page_size,
    pageCount: result.page_count,
    bookings: bookings.map(r => ({ ...simplifyReservation(r), ...(params.includePriceElements ? { priceElements: (r as unknown as Record<string, unknown>).priceElements } : {}), ...(params.includeRelated ? { related: (r as unknown as Record<string, unknown>).related } : {}) })),
  };
}

export async function getReservation(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = validate(
    validateRequired(params, ["reservationId"]),
    validatePositiveInt(params.reservationId, "reservationId"),
  );
  if (error) return error;

  const result = await client.request<SmoobuReservation>(
    `/api/reservations/${params.reservationId}`, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]
  );

  if (isError(result)) return result;

  return {
    id: result.id,
    referenceId: result["reference-id"],
    type: result.type,
    arrival: result.arrival,
    departure: result.departure,
    createdAt: result["created-at"],
    apartment: result.apartment,
    channel: result.channel?.name ?? "unknown",
    guestName: result["guest-name"],
    email: result.email,
    phone: result.phone,
    adults: result.adults,
    children: result.children,
    checkIn: result["check-in"],
    checkOut: result["check-out"],
    notice: result.notice,
    price: result.price,
    pricePaid: result["price-paid"],
    prepayment: result.prepayment,
    prepaymentPaid: result["prepayment-paid"],
    deposit: result.deposit,
    depositPaid: result["deposit-paid"],
    language: result.language,
    guestAppUrl: result["guest-app-url"],
    isBlocked: result["is-blocked-booking"],
    guestId: result.guestId,
  };
}

export async function getReservationPriceElements(
  client: SmoobuClient,
  params: Record<string, unknown>, signal?: AbortSignal
) {
  const error = validate(
    validateRequired(params, ["reservationId"]),
    validatePositiveInt(params.reservationId, "reservationId"),
  );
  if (error) return error;

  return client.request<SmoobuPriceElement[]>(
    `/api/reservations/${params.reservationId}/price-elements`, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]
  );
}

export async function getReservationPlaceholders(
  client: SmoobuClient,
  params: Record<string, unknown>, signal?: AbortSignal
) {
  const error = validate(
    validateRequired(params, ["reservationId"]),
    validatePositiveInt(params.reservationId, "reservationId"),
  );
  if (error) return error;

  return client.request<SmoobuPlaceholder[]>(
    `/api/reservations/${params.reservationId}/placeholders`, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]
  );
}

export async function createReservation(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const parsed = createReservationSchema.safeParse(params);
  if (!parsed.success) return createError("VALIDATION_ERROR", 400, "Invalid create_reservation parameters: " + parsed.error.issues.map(i => i.path.join(".") + ": " + i.message).join("; "));
  return client.mutate<{ id: number }>("POST", "/api/reservations", { ...parsed.data, channelId: parsed.data.channelId ?? 70 }, ...signal ? [signal] as [AbortSignal] : []);
}
export async function updateReservation(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const parsed = updateReservationSchema.safeParse(params);
  if (!parsed.success) return createError("VALIDATION_ERROR", 400, "Only documented update fields supported (guestName/guestEmail/guestPhone, not firstName/email). Dates, apartment/channel and address changes are not documented. " + parsed.error.issues.map(i => i.path.join(".") + ": " + i.message).join("; "));
  const { reservationId, ...payload } = parsed.data;
  return client.mutate<Record<string, unknown>>("PUT", "/api/reservations/" + reservationId, payload, ...signal ? [signal] as [AbortSignal] : []);
}

export async function cancelReservation(
  client: SmoobuClient,
  params: Record<string, unknown>, signal?: AbortSignal
) {
  const error = validate(
    validateRequired(params, ["reservationId"]),
    validatePositiveInt(params.reservationId, "reservationId"),
  );
  if (error) return error;

  return client.mutate<Record<string, unknown>>(
    "DELETE",
    `/api/reservations/${params.reservationId}`, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]
  );
}

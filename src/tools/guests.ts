import { validPage, invalidResponse } from "../response-validation.js";
import { isError, type SmoobuClient } from "../smoobu-client.js";
import type {
  SmoobuGuest,
  SmoobuPaginatedResponse,
  SimplifiedGuest,
} from "../types.js";
import {
  validate,
  validateEmail,
  validatePageSize,
  validatePositiveInt,
  validateRequired,
} from "../validation.js";

export const listGuestsTool = {
  name: "list_guests",
  description:
    "List guests with pagination. Returns simplified guest info (name, email, booking count). " +
    "Use get_guest for full details including contact info, address, and notes. " +
    "Use page and pageSize to control results (max 100 per page). " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      page: { type: "number", description: "Page number (default: 1)" },
      pageSize: { type: "number", description: "Results per page (1-100, default: 25)" },
    },
    required: [],
  },
};

export const getGuestTool = {
  name: "get_guest",
  description:
    "Get full details of a specific guest by ID, including all emails, phone numbers, " +
    "address, notes, and booking history. Use list_guests first to find guest IDs. " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      guestId: {
        type: "number",
        description: "The Smoobu guest ID (positive integer)",
      },
    },
    required: ["guestId"],
  },
};

function simplifyGuest(g: SmoobuGuest): SimplifiedGuest {
  return {
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    email: g.emails?.[0] ?? null,
    bookingsCount: g.bookings?.length ?? 0,
  };
}

export async function listGuests(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = validate(
    validatePositiveInt(params.page, "page"),
    validatePageSize(params.pageSize),
  );
  if (error) return error;

  const apiParams: Record<string, number> = { page: 1, pageSize: 25 };
  if (params.page) apiParams.page = Number(params.page);
  if (params.pageSize) apiParams.pageSize = Number(params.pageSize);

  const result = await client.request<{ guests: SmoobuGuest[]; totalItems: number; page: number; pageSize: number; pageCount: number }>(
    "/api/guests",
    apiParams, ...signal ? [signal] as [AbortSignal] : []
  );

  if (isError(result)) return result;

  if (!validPage(result, "guests", "camel")) return invalidResponse();
  const guests = (result.guests as SmoobuGuest[]) || [];

  return {
    totalItems: result.totalItems,
    page: result.page,
    pageSize: result.pageSize,
    pageCount: result.pageCount,
    guests: guests.map(simplifyGuest),
  };
}

export async function getGuest(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = validate(
    validateRequired(params, ["guestId"]),
    validatePositiveInt(params.guestId, "guestId"),
  );
  if (error) return error;

  return client.request<SmoobuGuest>(`/api/guests/${params.guestId}`, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]);
}

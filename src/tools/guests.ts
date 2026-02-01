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
    "Smoobu API rate limit: 1000 requests/minute.",
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
    "Smoobu API rate limit: 1000 requests/minute.",
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

export async function listGuests(client: SmoobuClient, params: Record<string, unknown>) {
  const error = validate(
    validatePositiveInt(params.page, "page"),
    validatePageSize(params.pageSize),
  );
  if (error) return error;

  const apiParams: Record<string, number> = {};
  if (params.page) apiParams.page_number = Number(params.page);
  if (params.pageSize) apiParams.page_size = Number(params.pageSize);

  const result = await client.request<SmoobuPaginatedResponse<SmoobuGuest>>(
    "/api/guests",
    apiParams,
  );

  if (isError(result)) return result;

  const guests = (result.guests as SmoobuGuest[]) || [];

  return {
    totalItems: result.total_items,
    page: result.page,
    pageSize: result.page_size,
    pageCount: result.page_count,
    guests: guests.map(simplifyGuest),
  };
}

export async function getGuest(client: SmoobuClient, params: Record<string, unknown>) {
  const error = validate(
    validateRequired(params, ["guestId"]),
    validatePositiveInt(params.guestId, "guestId"),
  );
  if (error) return error;

  return client.request<SmoobuGuest>(`/api/guests/${params.guestId}`);
}

export async function createGuest(
  client: SmoobuClient,
  params: Record<string, unknown>,
) {
  const error = validate(
    validateRequired(params, ["firstName", "lastName"]),
    params.email !== undefined ? validateEmail(params.email, "email") : null,
  );
  if (error) return error;

  const payload: Record<string, unknown> = {
    firstName: params.firstName,
    lastName: params.lastName,
  };

  const optionalFields = [
    "email", "phone", "companyName", "street",
    "postalCode", "location", "country", "notes",
  ];
  for (const field of optionalFields) {
    if (params[field] !== undefined) {
      payload[field] = params[field];
    }
  }

  return client.mutate<SmoobuGuest>("POST", "/api/guests", payload);
}

export async function updateGuest(
  client: SmoobuClient,
  params: Record<string, unknown>,
) {
  const error = validate(
    validateRequired(params, ["guestId"]),
    validatePositiveInt(params.guestId, "guestId"),
    params.email !== undefined ? validateEmail(params.email, "email") : null,
  );
  if (error) return error;

  const payload: Record<string, unknown> = {};
  const modifiableFields = [
    "firstName", "lastName", "email", "phone", "companyName",
    "street", "postalCode", "location", "country", "notes",
  ];
  for (const field of modifiableFields) {
    if (params[field] !== undefined) {
      payload[field] = params[field];
    }
  }

  if (Object.keys(payload).length === 0) {
    return validate(
      validateRequired({}, ["at least one field to update"]),
    );
  }

  return client.mutate<SmoobuGuest>(
    "PUT",
    `/api/guests/${params.guestId}`,
    payload,
  );
}

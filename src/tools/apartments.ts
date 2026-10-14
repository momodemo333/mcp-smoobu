import type { SmoobuClient } from "../smoobu-client.js";
import type { SmoobuApartment, SmoobuApartmentListItem } from "../types.js";
import { validate, validatePositiveInt, validateRequired } from "../validation.js";

export const listApartmentsTool = {
  name: "list_apartments",
  description:
    "List all properties (apartments, houses, rooms) in the Smoobu account. " +
    "Returns ID and name for each property. Use get_apartment for full details. " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export const getApartmentTool = {
  name: "get_apartment",
  description:
    "Get full details of a specific property by ID, including location, rooms, amenities, " +
    "currency, price range, and property type. Use list_apartments first to find property IDs. " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      apartmentId: {
        type: "number",
        description: "The Smoobu property ID (positive integer)",
      },
    },
    required: ["apartmentId"],
  },
};

export async function listApartments(client: SmoobuClient, signal?: AbortSignal) {
  const result = await client.request<{ apartments: SmoobuApartmentListItem[] }>("/api/apartments", ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]);
  return result;
}

export async function getApartment(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = validate(
    validateRequired(params, ["apartmentId"]),
    validatePositiveInt(params.apartmentId, "apartmentId"),
  );
  if (error) return error;

  return client.request<SmoobuApartment>(`/api/apartments/${params.apartmentId}`, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]);
}

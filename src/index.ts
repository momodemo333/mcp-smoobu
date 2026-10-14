#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SmoobuClient, isError } from "./smoobu-client.js";

// Tool handlers
import { getUser } from "./tools/user.js";
import { listApartments, getApartment } from "./tools/apartments.js";
import {
  listReservations, getReservation,
  getReservationPriceElements, getReservationPlaceholders,
  createReservation, updateReservation, cancelReservation,
} from "./tools/reservations.js";
import { listGuests, getGuest } from "./tools/guests.js";
import { listReservationMessages, listThreads, sendReservationMessage } from "./tools/messages.js";
import { listRates, checkApartmentAvailability, updateRates, previewRates, ratesSchema } from "./tools/rates.js";
import { createPriceElement, updatePriceElement, deletePriceElement, getPriceElement } from "./tools/price-elements.js";
import { listAddons } from "./tools/addons.js";
import { listCustomPlaceholders, getCustomPlaceholder } from "./tools/placeholders.js";
import { listWebhooks, getWebhook } from "./tools/webhooks.js";
import { createReservationSchema, updateReservationSchema, createPriceElementSchema, updatePriceElementSchema } from "./write-schemas.js";

const server = new McpServer({
  name: "mcp-smoobu",
  version: "0.2.0",
});

let client: SmoobuClient;

try {
  client = new SmoobuClient();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

/** Wrap handler result into MCP tool response */
function respond(result: unknown) {
  if (isError(result)) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

// ── User ──

server.tool(
  "get_user",
  "Get the current Smoobu user profile (name, email). Use this to verify the API connection or identify the account owner. Smoobu API rate limit: 700 requests/minute.",
  {},
  async (_params, extra) => respond(await getUser(client, extra.signal)),
);

// ── Properties ──

server.tool(
  "list_apartments",
  "List all properties (apartments, houses, rooms) in the Smoobu account. Returns ID and name for each property. Use get_apartment for full details. Smoobu API rate limit: 700 requests/minute.",
  {},
  async (_params, extra) => respond(await listApartments(client, extra.signal)),
);

server.tool(
  "get_apartment",
  "Get full details of a specific property by ID, including location, rooms, amenities, currency, price range, and property type. Use list_apartments first to find property IDs. Smoobu API rate limit: 700 requests/minute.",
  { apartmentId: z.number().describe("The Smoobu property ID (positive integer)") },
  async (params, extra) => respond(await getApartment(client, params, extra.signal)),
);

// ── Reservations ──

server.tool(
  "list_reservations",
  "List reservations with optional filters. IMPORTANT: Always use date filters to limit results. If no date filter is provided, defaults to arrivals from 30 days ago to 90 days ahead. Use page and pageSize for pagination (max 100 per page). Response includes totalItems to know the full count. Smoobu API rate limit: 700 requests/minute.",
  {
    arrivalFrom: z.string().optional().describe("Filter arrivals from this date (YYYY-MM-DD)"),
    arrivalTo: z.string().optional().describe("Filter arrivals until this date (YYYY-MM-DD)"),
    departureFrom: z.string().optional().describe("Filter departures from this date (YYYY-MM-DD)"),
    departureTo: z.string().optional().describe("Filter departures until this date (YYYY-MM-DD)"),
    createdFrom: z.string().optional().describe("Filter by creation date from (YYYY-MM-DD)"),
    createdTo: z.string().optional().describe("Filter by creation date until (YYYY-MM-DD)"),
    modifiedFrom: z.string().optional().describe("Filter by modification date from (YYYY-MM-DD)"),
    modifiedTo: z.string().optional().describe("Filter by modification date until (YYYY-MM-DD)"),
    apartmentId: z.number().optional().describe("Filter by property ID"),
    showCancellation: z.boolean().optional().describe("Include cancelled bookings (default: false)"),
    excludeBlocked: z.boolean().optional().describe("Exclude blocked periods (default: false)"),
    includeRelated: z.boolean().optional().describe("Include related bookings (default: false)"),
    includePriceElements: z.boolean().optional().describe("Include price breakdown (default: false)"),
    page: z.number().optional().describe("Page number (default: 1)"),
    pageSize: z.number().optional().describe("Results per page (1-100, default: 25)"),
  },
  async (params, extra) => respond(await listReservations(client, params, extra.signal)),
);

server.tool(
  "get_reservation",
  "Get full details of a specific reservation by ID, including guest contact info, prices, check-in/out times, and notices. Use list_reservations first to find reservation IDs. Smoobu API rate limit: 700 requests/minute.",
  { reservationId: z.number().describe("The Smoobu reservation ID (positive integer)") },
  async (params, extra) => respond(await getReservation(client, params, extra.signal)),
);

server.tool(
  "get_reservation_price_elements",
  "Get the price breakdown of a reservation (accommodation, extras, taxes, etc.). Smoobu API rate limit: 700 requests/minute.",
  { reservationId: z.number().describe("The Smoobu reservation ID (positive integer)") },
  async (params, extra) => respond(await getReservationPriceElements(client, params, extra.signal)),
);

server.tool(
  "get_reservation_placeholders",
  "Get placeholder key-value pairs for a reservation (used in message templates). Smoobu API rate limit: 700 requests/minute.",
  { reservationId: z.number().describe("The Smoobu reservation ID (positive integer)") },
  async (params, extra) => respond(await getReservationPlaceholders(client, params, extra.signal)),
);

// ── Guests ──

server.tool(
  "list_guests",
  "List guests with pagination. Returns simplified guest info (name, email, booking count). Use get_guest for full details including contact info, address, and notes. Use page and pageSize to control results (max 100 per page). Smoobu API rate limit: 700 requests/minute.",
  {
    page: z.number().optional().describe("Page number (default: 1)"),
    pageSize: z.number().optional().describe("Results per page (1-100, default: 25)"),
  },
  async (params, extra) => respond(await listGuests(client, params, extra.signal)),
);

server.tool(
  "get_guest",
  "Get full details of a specific guest by ID, including all emails, phone numbers, address, notes, and booking history. Use list_guests first to find guest IDs. Smoobu API rate limit: 700 requests/minute.",
  { guestId: z.number().describe("The Smoobu guest ID (positive integer)") },
  async (params, extra) => respond(await getGuest(client, params, extra.signal)),
);

// ── Messages ──

server.tool(
  "list_reservation_messages",
  "List messages for a specific reservation. Returns message subject, content, and type. Use this to see communication history for a booking. Smoobu API rate limit: 700 requests/minute.",
  {
    reservationId: z.number().describe("The Smoobu reservation ID (positive integer)"),
    onlyRelatedToGuest: z.boolean().optional().describe("false includes all booking messages; omitted preserves API default"),
    maxContentChars: z.number().int().min(100).max(100000).optional().describe("Per message text cap (default 4000); truncated flag supplied"),
    page: z.number().optional().describe("Page number (default: 1)"),
  },
  async (params, extra) => respond(await listReservationMessages(client, params, extra.signal)),
);

server.tool(
  "list_threads",
  "List message threads across all or specific properties. Shows latest message per thread with guest and apartment info. Use apartments filter to narrow by property. Smoobu API rate limit: 700 requests/minute.",
  {
    maxContentChars: z.number().int().min(100).max(100000).optional().describe("Per latest message text cap, default 4000"),
    page: z.number().optional().describe("Page number (default: 1)"),
    pageSize: z.number().optional().describe("Results per page (1-100, default: 25)"),
    apartments: z.array(z.number()).optional().describe("Filter by apartment IDs"),
  },
  async (params, extra) => respond(await listThreads(client, params, extra.signal)),
);

// ── Rates ──

server.tool(
  "list_rates",
  "Get daily rates and availability for properties over a date range. Returns price, minimum stay, and availability per day per property. Maximum date range: 365 days. Use apartments filter to limit to specific properties. Dates must be in YYYY-MM-DD format. Smoobu API rate limit: 700 requests/minute.",
  {
    startDate: z.string().describe("Start date (YYYY-MM-DD, required)"),
    endDate: z.string().describe("End date (YYYY-MM-DD, required)"),
    apartments: z.array(z.number().int().positive()).min(1).describe("Required apartment IDs"),
  },
  async (params, extra) => respond(await listRates(client, params, extra.signal)),
);

// ── Addons ──

server.tool(
  "list_addons",
  "List available service add-ons (extras, fees, services). Optionally filter by apartment ID. Returns name, amount, tax, and configuration. Smoobu API rate limit: 700 requests/minute.",
  {
    apartmentId: z.number().optional().describe("Filter by apartment ID (optional)"),
  },
  async (params, extra) => respond(await listAddons(client, params, extra.signal)),
);

// ── Custom Placeholders ──

server.tool(
  "list_custom_placeholders",
  "List all custom placeholders (text variables used in message templates). Returns ID, key, default value, and type. Use get_custom_placeholder for full details including translations. Smoobu API rate limit: 700 requests/minute.",
  {},
  async (_params, extra) => respond(await listCustomPlaceholders(client, extra.signal)),
);

server.tool(
  "get_custom_placeholder",
  "Get a custom placeholder by ID, including all translations. Use list_custom_placeholders first to find placeholder IDs. Smoobu API rate limit: 700 requests/minute.",
  { customPlaceholderId: z.number().describe("The custom placeholder ID (positive integer)") },
  async (params, extra) => respond(await getCustomPlaceholder(client, params, extra.signal)),
);

// ── Online Check-In ──


// ── Write Operations ──

// -- Availability Check (POST but read-only) --

server.tool(
  "check_apartment_availability",
  "Check if a property is available for a given date range. This is a read-only check (no data is modified). Use this before creating a reservation to verify availability.",
  {
    apartmentId: z.number().describe("The Smoobu property ID to check"),
    arrivalDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
    departureDate: z.string().describe("Check-out date (YYYY-MM-DD, must be after arrivalDate)"),
  },
  async (params, extra) => respond(await checkApartmentAvailability(client, params, extra.signal)),
);

// -- Messages --

server.registerTool("send_reservation_message", { description: "Send a REAL guest message immediately. Optional subject, nonblank body; no templateId. Explicit authorization required.", inputSchema: z.strictObject({ reservationId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), subject: z.string().optional(), body: z.string().refine(v => v.trim().length > 0) }), annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false } }, async (params, extra) => respond(await sendReservationMessage(client, params, extra.signal)));

// -- Guests --



// -- Reservations --

server.registerTool("create_reservation", { description: "Create a REAL Smoobu reservation. Check availability and obtain explicit authorization first.", inputSchema: createReservationSchema, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } }, async (params, extra) => respond(await createReservation(client, params, extra.signal)));
server.registerTool("update_reservation", { description: "Update documented Smoobu booking fields only. Does NOT accept an Airbnb alteration request or change dates/property.", inputSchema: updateReservationSchema, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } }, async (params, extra) => respond(await updateReservation(client, params, extra.signal)));
server.tool(
  "cancel_reservation",
  "⚠️ CANCEL a reservation. This will PERMANENTLY CANCEL the reservation and free the dates. This action CANNOT be undone. Make sure you have the correct reservation ID.",
  {
    reservationId: z.number().describe("The reservation ID to cancel (THIS CANNOT BE UNDONE)"),
  },
  async (params, extra) => respond(await cancelReservation(client, params, extra.signal)),
);

// -- Price Elements --

server.registerTool("create_price_element", { description: "Add a real reservation price element. Requires explicit currencyCode.", inputSchema: createPriceElementSchema, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } }, async (params, extra) => respond(await createPriceElement(client, params, extra.signal)));
server.registerTool("update_price_element", { description: "Update a real price element via documented POST. Requires name, amount and currencyCode.", inputSchema: updatePriceElementSchema, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } }, async (params, extra) => respond(await updatePriceElement(client, params, extra.signal)));
server.tool(
  "delete_price_element",
  "⚠️ DELETE a price element from a reservation. This PERMANENTLY REMOVES the price element. This action CANNOT be undone.",
  {
    reservationId: z.number().describe("Reservation ID"),
    elementId: z.number().describe("Price element ID to delete (THIS CANNOT BE UNDONE)"),
  },
  async (params, extra) => respond(await deletePriceElement(client, params, extra.signal)),
);

// -- Rates --

server.registerTool("update_rates", { description: "Change REAL prices/minimum stays via POST /api/rates. Never changes availability. Use preview_rates first. Legacy priceItems is rejected.", inputSchema: ratesSchema, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } }, async (params, extra) => respond(await updateRates(client, params, extra.signal)));
server.registerTool("preview_rates", { description: "Pure validation and payload preview. No network, no before/after snapshot, no authorization to apply.", inputSchema: ratesSchema, annotations: { readOnlyHint: true } }, async params => respond(previewRates(params)));
server.tool("get_capabilities", "Local diagnostic of authentication mode, effective write permissions and unsupported operations. No network or secrets.", {}, async () => respond(client.capabilities()));
server.tool("get_price_element", "Read a single reservation price element.", { reservationId: z.number().int().positive(), elementId: z.number().int().positive() }, async (params, extra) => respond(await getPriceElement(client, params, extra.signal)));
server.tool("list_webhooks", "Read visible webhook metadata; callback paths/queries redacted to avoid exposing secrets.", {}, async (_params, extra) => respond(await listWebhooks(client, extra.signal)));
server.tool("get_webhook", "Read webhook metadata by ID; callback paths/queries redacted.", { webhookId: z.number().int().positive() }, async (params, extra) => respond(await getWebhook(client, params, extra.signal)));

// ── Start server ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});

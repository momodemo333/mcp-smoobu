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
import { listGuests, getGuest, createGuest, updateGuest } from "./tools/guests.js";
import { listReservationMessages, listThreads, sendReservationMessage } from "./tools/messages.js";
import { listRates, checkApartmentAvailability, updateRates } from "./tools/rates.js";
import { createPriceElement, updatePriceElement, deletePriceElement } from "./tools/price-elements.js";
import { listAddons } from "./tools/addons.js";
import { listCustomPlaceholders, getCustomPlaceholder } from "./tools/placeholders.js";
import { listOnlineCheckIns } from "./tools/check-in.js";

const server = new McpServer({
  name: "mcp-smoobu",
  version: "0.1.0",
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
  "Get the current Smoobu user profile (name, email). Use this to verify the API connection or identify the account owner. Smoobu API rate limit: 1000 requests/minute.",
  {},
  async () => respond(await getUser(client)),
);

// ── Properties ──

server.tool(
  "list_apartments",
  "List all properties (apartments, houses, rooms) in the Smoobu account. Returns ID and name for each property. Use get_apartment for full details. Smoobu API rate limit: 1000 requests/minute.",
  {},
  async () => respond(await listApartments(client)),
);

server.tool(
  "get_apartment",
  "Get full details of a specific property by ID, including location, rooms, amenities, currency, price range, and property type. Use list_apartments first to find property IDs. Smoobu API rate limit: 1000 requests/minute.",
  { apartmentId: z.number().describe("The Smoobu property ID (positive integer)") },
  async (params) => respond(await getApartment(client, params)),
);

// ── Reservations ──

server.tool(
  "list_reservations",
  "List reservations with optional filters. IMPORTANT: Always use date filters to limit results. If no date filter is provided, defaults to arrivals from 30 days ago to 90 days ahead. Use page and pageSize for pagination (max 100 per page). Response includes totalItems to know the full count. Smoobu API rate limit: 1000 requests/minute.",
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
  async (params) => respond(await listReservations(client, params)),
);

server.tool(
  "get_reservation",
  "Get full details of a specific reservation by ID, including guest contact info, prices, check-in/out times, and notices. Use list_reservations first to find reservation IDs. Smoobu API rate limit: 1000 requests/minute.",
  { reservationId: z.number().describe("The Smoobu reservation ID (positive integer)") },
  async (params) => respond(await getReservation(client, params)),
);

server.tool(
  "get_reservation_price_elements",
  "Get the price breakdown of a reservation (accommodation, extras, taxes, etc.). Smoobu API rate limit: 1000 requests/minute.",
  { reservationId: z.number().describe("The Smoobu reservation ID (positive integer)") },
  async (params) => respond(await getReservationPriceElements(client, params)),
);

server.tool(
  "get_reservation_placeholders",
  "Get placeholder key-value pairs for a reservation (used in message templates). Smoobu API rate limit: 1000 requests/minute.",
  { reservationId: z.number().describe("The Smoobu reservation ID (positive integer)") },
  async (params) => respond(await getReservationPlaceholders(client, params)),
);

// ── Guests ──

server.tool(
  "list_guests",
  "List guests with pagination. Returns simplified guest info (name, email, booking count). Use get_guest for full details including contact info, address, and notes. Use page and pageSize to control results (max 100 per page). Smoobu API rate limit: 1000 requests/minute.",
  {
    page: z.number().optional().describe("Page number (default: 1)"),
    pageSize: z.number().optional().describe("Results per page (1-100, default: 25)"),
  },
  async (params) => respond(await listGuests(client, params)),
);

server.tool(
  "get_guest",
  "Get full details of a specific guest by ID, including all emails, phone numbers, address, notes, and booking history. Use list_guests first to find guest IDs. Smoobu API rate limit: 1000 requests/minute.",
  { guestId: z.number().describe("The Smoobu guest ID (positive integer)") },
  async (params) => respond(await getGuest(client, params)),
);

// ── Messages ──

server.tool(
  "list_reservation_messages",
  "List messages for a specific reservation. Returns message subject, content, and type. Use this to see communication history for a booking. Smoobu API rate limit: 1000 requests/minute.",
  {
    reservationId: z.number().describe("The Smoobu reservation ID (positive integer)"),
    page: z.number().optional().describe("Page number (default: 1)"),
  },
  async (params) => respond(await listReservationMessages(client, params)),
);

server.tool(
  "list_threads",
  "List message threads across all or specific properties. Shows latest message per thread with guest and apartment info. Use apartments filter to narrow by property. Smoobu API rate limit: 1000 requests/minute.",
  {
    page: z.number().optional().describe("Page number (default: 1)"),
    pageSize: z.number().optional().describe("Results per page (1-100, default: 25)"),
    apartments: z.array(z.number()).optional().describe("Filter by apartment IDs"),
  },
  async (params) => respond(await listThreads(client, params)),
);

// ── Rates ──

server.tool(
  "list_rates",
  "Get daily rates and availability for properties over a date range. Returns price, minimum stay, and availability per day per property. Maximum date range: 365 days. Use apartments filter to limit to specific properties. Dates must be in YYYY-MM-DD format. Smoobu API rate limit: 1000 requests/minute.",
  {
    startDate: z.string().describe("Start date (YYYY-MM-DD, required)"),
    endDate: z.string().describe("End date (YYYY-MM-DD, required)"),
    apartments: z.array(z.number()).optional().describe("Filter by apartment IDs (optional)"),
  },
  async (params) => respond(await listRates(client, params)),
);

// ── Addons ──

server.tool(
  "list_addons",
  "List available service add-ons (extras, fees, services). Optionally filter by apartment ID. Returns name, amount, tax, and configuration. Smoobu API rate limit: 1000 requests/minute.",
  {
    apartmentId: z.number().optional().describe("Filter by apartment ID (optional)"),
  },
  async (params) => respond(await listAddons(client, params)),
);

// ── Custom Placeholders ──

server.tool(
  "list_custom_placeholders",
  "List all custom placeholders (text variables used in message templates). Returns ID, key, default value, and type. Use get_custom_placeholder for full details including translations. Smoobu API rate limit: 1000 requests/minute.",
  {},
  async () => respond(await listCustomPlaceholders(client)),
);

server.tool(
  "get_custom_placeholder",
  "Get a custom placeholder by ID, including all translations. Use list_custom_placeholders first to find placeholder IDs. Smoobu API rate limit: 1000 requests/minute.",
  { customPlaceholderId: z.number().describe("The custom placeholder ID (positive integer)") },
  async (params) => respond(await getCustomPlaceholder(client, params)),
);

// ── Online Check-In ──

server.tool(
  "list_online_check_ins",
  "List online check-in records. Optionally filter by status. Use page and pageSize for pagination (max 100 per page). Note: This feature may need to be enabled in your Smoobu account. Smoobu API rate limit: 1000 requests/minute.",
  {
    page: z.number().optional().describe("Page number (default: 1)"),
    pageSize: z.number().optional().describe("Results per page (1-100, default: 25)"),
    status: z.string().optional().describe("Filter by check-in status"),
  },
  async (params) => respond(await listOnlineCheckIns(client, params)),
);

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
  async (params) => respond(await checkApartmentAvailability(client, params)),
);

// -- Messages --

server.tool(
  "send_reservation_message",
  "Send a message to a guest for a specific reservation. The message is sent IMMEDIATELY via Smoobu's messaging system. Use list_reservation_messages first to see conversation history.",
  {
    reservationId: z.number().describe("Reservation ID"),
    subject: z.string().describe("Message subject"),
    body: z.string().describe("Message body (plain text)"),
    templateId: z.number().optional().describe("Optional message template ID"),
  },
  async (params) => respond(await sendReservationMessage(client, params)),
);

// -- Guests --

server.tool(
  "create_guest",
  "Create a new guest profile in Smoobu. Only firstName and lastName are required. The guest can later be associated with reservations.",
  {
    firstName: z.string().describe("Guest first name (required)"),
    lastName: z.string().describe("Guest last name (required)"),
    email: z.string().optional().describe("Guest email address"),
    phone: z.string().optional().describe("Guest phone number"),
    companyName: z.string().optional().describe("Company name"),
    street: z.string().optional().describe("Street address"),
    postalCode: z.string().optional().describe("Postal/ZIP code"),
    location: z.string().optional().describe("City/location"),
    country: z.string().optional().describe("Country"),
    notes: z.string().optional().describe("Internal notes about the guest"),
  },
  async (params) => respond(await createGuest(client, params)),
);

server.tool(
  "update_guest",
  "Update an existing guest's information. Provide the guestId and any fields to update. Only provided fields will be changed.",
  {
    guestId: z.number().describe("The Smoobu guest ID to update"),
    firstName: z.string().optional().describe("Guest first name"),
    lastName: z.string().optional().describe("Guest last name"),
    email: z.string().optional().describe("Guest email address"),
    phone: z.string().optional().describe("Guest phone number"),
    companyName: z.string().optional().describe("Company name"),
    street: z.string().optional().describe("Street address"),
    postalCode: z.string().optional().describe("Postal/ZIP code"),
    location: z.string().optional().describe("City/location"),
    country: z.string().optional().describe("Country"),
    notes: z.string().optional().describe("Internal notes about the guest"),
  },
  async (params) => respond(await updateGuest(client, params)),
);

// -- Reservations --

server.tool(
  "create_reservation",
  "Create a new reservation in Smoobu. IMPORTANT: This creates a REAL booking in production. " +
  "Recommended: use check_apartment_availability first to verify the dates are free. " +
  "Defaults to channel 'manual' (channelId=70) unless specified.",
  {
    arrivalDate: z.string().describe("Check-in date (YYYY-MM-DD, required)"),
    departureDate: z.string().describe("Check-out date (YYYY-MM-DD, required, must be after arrivalDate)"),
    apartmentId: z.number().describe("Property ID (required)"),
    channelId: z.number().optional().describe("Booking channel ID (default: 70 = manual)"),
    arrivalTime: z.string().optional().describe("Check-in time (HH:MM)"),
    departureTime: z.string().optional().describe("Check-out time (HH:MM)"),
    firstName: z.string().optional().describe("Guest first name"),
    lastName: z.string().optional().describe("Guest last name"),
    email: z.string().optional().describe("Guest email"),
    phone: z.string().optional().describe("Guest phone"),
    notice: z.string().optional().describe("Internal notes"),
    adults: z.number().optional().describe("Number of adults"),
    children: z.number().optional().describe("Number of children"),
    price: z.number().optional().describe("Total price (>= 0)"),
    priceStatus: z.number().optional().describe("Price status (0=open, 1=paid)"),
    prepayment: z.number().optional().describe("Prepayment amount (>= 0)"),
    prepaymentStatus: z.number().optional().describe("Prepayment status (0=open, 1=paid)"),
    deposit: z.number().optional().describe("Deposit amount (>= 0)"),
    depositStatus: z.number().optional().describe("Deposit status (0=open, 1=paid)"),
    language: z.string().optional().describe("Guest language (e.g. 'en', 'fr', 'de')"),
    address: z.string().optional().describe("Guest address"),
  },
  async (params) => respond(await createReservation(client, params)),
);

server.tool(
  "update_reservation",
  "Update an existing reservation. Provide reservationId and any fields to change. Only provided fields will be modified.",
  {
    reservationId: z.number().describe("Reservation ID to update (required)"),
    arrivalDate: z.string().optional().describe("New check-in date (YYYY-MM-DD)"),
    departureDate: z.string().optional().describe("New check-out date (YYYY-MM-DD)"),
    apartmentId: z.number().optional().describe("New property ID"),
    channelId: z.number().optional().describe("New channel ID"),
    arrivalTime: z.string().optional().describe("Check-in time (HH:MM)"),
    departureTime: z.string().optional().describe("Check-out time (HH:MM)"),
    firstName: z.string().optional().describe("Guest first name"),
    lastName: z.string().optional().describe("Guest last name"),
    email: z.string().optional().describe("Guest email"),
    phone: z.string().optional().describe("Guest phone"),
    notice: z.string().optional().describe("Internal notes"),
    adults: z.number().optional().describe("Number of adults"),
    children: z.number().optional().describe("Number of children"),
    price: z.number().optional().describe("Total price (>= 0)"),
    priceStatus: z.number().optional().describe("Price status"),
    prepayment: z.number().optional().describe("Prepayment amount (>= 0)"),
    prepaymentStatus: z.number().optional().describe("Prepayment status"),
    deposit: z.number().optional().describe("Deposit amount (>= 0)"),
    depositStatus: z.number().optional().describe("Deposit status"),
    language: z.string().optional().describe("Guest language"),
    address: z.string().optional().describe("Guest address"),
  },
  async (params) => respond(await updateReservation(client, params)),
);

server.tool(
  "cancel_reservation",
  "⚠️ CANCEL a reservation. This will PERMANENTLY CANCEL the reservation and free the dates. This action CANNOT be undone. Make sure you have the correct reservation ID.",
  {
    reservationId: z.number().describe("The reservation ID to cancel (THIS CANNOT BE UNDONE)"),
  },
  async (params) => respond(await cancelReservation(client, params)),
);

// -- Price Elements --

server.tool(
  "create_price_element",
  "Add a price element (tax, extra, fee, discount) to a reservation. This modifies the reservation's price breakdown.",
  {
    reservationId: z.number().describe("Reservation ID"),
    name: z.string().describe("Name of the price element (e.g. 'Cleaning fee', 'City tax')"),
    amount: z.number().describe("Amount (>= 0)"),
    type: z.string().optional().describe("Element type"),
    quantity: z.number().optional().describe("Quantity (default: 1)"),
    tax: z.number().optional().describe("Tax percentage (>= 0)"),
    currencyCode: z.string().optional().describe("Currency code (e.g. 'EUR')"),
    sortOrder: z.number().optional().describe("Display sort order"),
    priceIncludedInId: z.number().optional().describe("ID of parent price element if included in another"),
  },
  async (params) => respond(await createPriceElement(client, params)),
);

server.tool(
  "update_price_element",
  "Update an existing price element on a reservation. Provide reservationId, elementId, and fields to change.",
  {
    reservationId: z.number().describe("Reservation ID"),
    elementId: z.number().describe("Price element ID to update"),
    name: z.string().optional().describe("Name of the price element"),
    amount: z.number().optional().describe("Amount (>= 0)"),
    type: z.string().optional().describe("Element type"),
    quantity: z.number().optional().describe("Quantity"),
    tax: z.number().optional().describe("Tax percentage (>= 0)"),
    currencyCode: z.string().optional().describe("Currency code"),
    sortOrder: z.number().optional().describe("Display sort order"),
    priceIncludedInId: z.number().optional().describe("ID of parent price element"),
  },
  async (params) => respond(await updatePriceElement(client, params)),
);

server.tool(
  "delete_price_element",
  "⚠️ DELETE a price element from a reservation. This PERMANENTLY REMOVES the price element. This action CANNOT be undone.",
  {
    reservationId: z.number().describe("Reservation ID"),
    elementId: z.number().describe("Price element ID to delete (THIS CANNOT BE UNDONE)"),
  },
  async (params) => respond(await deletePriceElement(client, params)),
);

// -- Rates --

server.tool(
  "update_rates",
  "⚠️ Update daily rates and availability for properties. This DIRECTLY MODIFIES pricing and availability in production. " +
  "Each apartment entry should contain an 'id' and 'priceItems' array with date-specific settings.",
  {
    apartments: z.array(z.object({
      id: z.number().describe("Property ID"),
      priceItems: z.array(z.object({
        date: z.string().describe("Date (YYYY-MM-DD)"),
        price: z.number().optional().describe("Daily price (>= 0)"),
        min_length_of_stay: z.number().optional().describe("Minimum stay in nights"),
        available: z.number().optional().describe("Availability (0=blocked, 1=available)"),
      })).describe("Array of daily rate settings"),
    })).describe("Array of apartment rate updates"),
  },
  async (params) => respond(await updateRates(client, params)),
);

// ── Start server ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});

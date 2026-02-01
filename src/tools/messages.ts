import { isError, type SmoobuClient } from "../smoobu-client.js";
import type {
  SmoobuMessage,
  SmoobuPaginatedResponse,
  SmoobuThread,
  SimplifiedThread,
} from "../types.js";
import {
  validate,
  validateNumberArray,
  validatePageSize,
  validatePositiveInt,
  validateRequired,
} from "../validation.js";

export const listReservationMessagesTool = {
  name: "list_reservation_messages",
  description:
    "List messages for a specific reservation. Returns message subject, content, and type. " +
    "Use this to see communication history for a booking. " +
    "Smoobu API rate limit: 1000 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      reservationId: {
        type: "number",
        description: "The Smoobu reservation ID (positive integer)",
      },
      page: { type: "number", description: "Page number (default: 1)" },
    },
    required: ["reservationId"],
  },
};

export const listThreadsTool = {
  name: "list_threads",
  description:
    "List message threads across all or specific properties. Shows latest message per thread " +
    "with guest and apartment info. Use apartments filter to narrow by property. " +
    "Smoobu API rate limit: 1000 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      page: { type: "number", description: "Page number (default: 1)" },
      pageSize: { type: "number", description: "Results per page (1-100, default: 25)" },
      apartments: {
        type: "array",
        items: { type: "number" },
        description: "Filter by apartment IDs",
      },
    },
    required: [],
  },
};

function simplifyThread(t: SmoobuThread): SimplifiedThread {
  return {
    booking: { id: t.booking.id, guestName: t.booking.guest_name },
    apartment: t.apartment,
    latestMessage: {
      id: t.latest_message.id,
      subject: t.latest_message.subject,
      textContent: t.latest_message.text_content,
      createdAt: t.latest_message.created_at,
    },
  };
}

export async function listReservationMessages(
  client: SmoobuClient,
  params: Record<string, unknown>,
) {
  const error = validate(
    validateRequired(params, ["reservationId"]),
    validatePositiveInt(params.reservationId, "reservationId"),
    validatePositiveInt(params.page, "page"),
  );
  if (error) return error;

  const apiParams: Record<string, number> = {};
  if (params.page) apiParams.page = Number(params.page);

  const result = await client.request<SmoobuPaginatedResponse<SmoobuMessage>>(
    `/api/reservations/${params.reservationId}/messages`,
    apiParams,
  );

  if (isError(result)) return result;

  const messages = (result.messages as SmoobuMessage[]) || [];

  return {
    totalItems: result.total_items,
    page: result.page,
    pageSize: result.page_size,
    pageCount: result.page_count,
    messages: messages.map(({ id, subject, message, type }) => ({
      id,
      subject,
      message,
      type,
    })),
  };
}

export async function sendReservationMessage(
  client: SmoobuClient,
  params: Record<string, unknown>,
) {
  const error = validate(
    validateRequired(params, ["reservationId", "subject", "body"]),
    validatePositiveInt(params.reservationId, "reservationId"),
  );
  if (error) return error;

  const payload: Record<string, unknown> = {
    subject: params.subject,
    body: params.body,
  };
  if (params.templateId !== undefined) {
    payload.templateId = params.templateId;
  }

  return client.mutate<Record<string, unknown>>(
    "POST",
    `/api/reservations/${params.reservationId}/messages`,
    payload,
  );
}

export async function listThreads(client: SmoobuClient, params: Record<string, unknown>) {
  const error = validate(
    validatePositiveInt(params.page, "page"),
    validatePageSize(params.pageSize),
    validateNumberArray(params.apartments, "apartments"),
  );
  if (error) return error;

  const apiParams: Record<string, string | number | number[]> = {};
  if (params.page) apiParams.page_number = Number(params.page);
  if (params.pageSize) apiParams.page_size = Number(params.pageSize);
  if (params.apartments) apiParams.apartments = params.apartments as number[];

  const result = await client.request<{
    page_number: number;
    page_size: number;
    page_count: number;
    total_threads: number;
    unread_messages: number;
    threads: SmoobuThread[];
  }>("/api/threads", apiParams);

  if (isError(result)) return result;

  return {
    totalThreads: result.total_threads,
    unreadMessages: result.unread_messages,
    page: result.page_number,
    pageSize: result.page_size,
    pageCount: result.page_count,
    threads: (result.threads || []).map(simplifyThread),
  };
}

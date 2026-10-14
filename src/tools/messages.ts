import { validPage, invalidResponse } from "../response-validation.js";
import { z } from "zod";
import { isError, type SmoobuClient } from "../smoobu-client.js";
import { createError } from "../errors.js";
import type { SmoobuMessage, SmoobuPaginatedResponse, SmoobuThread } from "../types.js";
import { validate, validateNumberArray, validatePageSize, validatePositiveInt, validateRequired } from "../validation.js";

/** Text extraction only, NOT an HTML sanitizer for rendering. Never executes or loads resources. */
export function htmlToText(html: string): string {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[^]*?-->/g, "").replace(/<br\s*\/?\s*>|<\/(?:p|div|li|tr|h[1-6])\s*>/gi, "\n").replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, entity: string) => {
      const names: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      if (!entity.startsWith("#")) return names[entity.toLowerCase()] ?? all;
      const n = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "�";
    }).trim();
}
function content(text: string | undefined, html: string | undefined, limit: number) {
  const value = text?.trim() ? text : htmlToText(html ?? "");
  return { text: value.slice(0, limit), truncated: value.length > limit, originalLength: value.length, source: text?.trim() ? "plain-text" : "html-fallback" };
}
function contentLimit(params: Record<string, unknown>) {
  const result = z.number().int().min(100).max(100000).safeParse(params.maxContentChars ?? 4000);
  return result.success ? result.data : createError("VALIDATION_ERROR", 400, "maxContentChars must be 100..100000.");
}
export async function listReservationMessages(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = validate(validateRequired(params, ["reservationId"]), validatePositiveInt(params.reservationId, "reservationId"), validatePositiveInt(params.page, "page"));
  if (error) return error;
  const limit = contentLimit(params); if (isError(limit)) return limit;
  if (params.onlyRelatedToGuest !== undefined && typeof params.onlyRelatedToGuest !== "boolean") return createError("VALIDATION_ERROR", 400, "onlyRelatedToGuest must be boolean.");
  const apiParams: Record<string, number | boolean> = { page: (params.page as number) ?? 1 };
  if (params.onlyRelatedToGuest !== undefined) apiParams.onlyRelatedToGuest = params.onlyRelatedToGuest as boolean;
  const result = await client.request<SmoobuPaginatedResponse<SmoobuMessage>>(
    "/api/reservations/" + params.reservationId + "/messages", apiParams, ...signal ? [signal] as [AbortSignal] : []);
  if (isError(result)) return result;
  if (!validPage(result, "messages")) return invalidResponse();
  return { totalItems: result.total_items, page: result.page, pageSize: result.page_size, pageCount: result.page_count,
    nextPage: result.page < result.page_count ? result.page + 1 : null,
    messages: ((result.messages as SmoobuMessage[]) ?? []).map(m => {
      const c = content(m.message, m.messageHtml || m.htmlMessage, limit);
      return { id: m.id, subject: m.subject, message: c.text, type: m.type, contentSource: c.source, contentTruncated: c.truncated, originalContentLength: c.originalLength };
    }) };
}
export async function listThreads(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = validate(validatePositiveInt(params.page, "page"), validatePageSize(params.pageSize), validateNumberArray(params.apartments, "apartments"));
  if (error) return error;
  const limit = contentLimit(params); if (isError(limit)) return limit;
  const query: Record<string, number | number[]> = { page_number: (params.page as number) ?? 1, page_size: (params.pageSize as number) ?? 25 };
  if (params.apartments !== undefined) query.apartments = params.apartments as number[];
  const result = await client.request<{ page_number: number; page_size: number; page_count: number; total_threads: number; unread_messages: number; threads: SmoobuThread[] }>("/api/threads", query, ...signal ? [signal] as [AbortSignal] : []);
  if (isError(result)) return result;
  if (!validPage(result, "threads", "threads")) return invalidResponse();
  return { totalThreads: result.total_threads, unreadMessages: result.unread_messages, page: result.page_number, pageSize: result.page_size, pageCount: result.page_count,
    nextPage: result.page_number < result.page_count ? result.page_number + 1 : null,
    threads: (result.threads ?? []).map(t => {
      const c = content(t.latest_message.text_content, t.latest_message.html_content, limit);
      return { booking: { id: t.booking.id, guestName: t.booking.guest_name }, apartment: t.apartment,
        latestMessage: { id: t.latest_message.id, subject: t.latest_message.subject, textContent: c.text, createdAt: t.latest_message.created_at, contentSource: c.source, contentTruncated: c.truncated, originalContentLength: c.originalLength } };
    }) };
}
export async function sendReservationMessage(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const parsed = z.strictObject({ reservationId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), subject: z.string().optional(), body: z.string().refine(v => v.trim().length > 0, "body must not be blank") }).safeParse(params);
  if (!parsed.success) return createError("VALIDATION_ERROR", 400, "Provide reservationId, nonblank body and optional subject; templateId is not documented/supported.");
  const { reservationId, body, subject } = parsed.data;
  return client.mutate<Record<string, unknown>>("POST", "/api/reservations/" + reservationId + "/messages/send-message-to-guest", { ...(subject === undefined ? {} : { subject }), messageBody: body }, ...signal ? [signal] as [AbortSignal] : []);
}

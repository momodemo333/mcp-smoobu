import { createError } from "./errors.js";
export function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
const integer = (value: unknown, min = 0): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= min;
export function invalidResponse(mutation = false, status = 502) {
  return createError("INVALID_RESPONSE", status, mutation ? "Mutation confirmation is missing or invalid; outcome unknown. Re-read state before any manual retry." : "Smoobu response has an invalid or missing envelope/pagination.");
}
/** Validate required pagination metadata and array before simplifying, never invent an empty page. */
export function validPage(value: unknown, list: string, casing: "snake" | "camel" | "threads" = "snake"): boolean {
  if (!object(value) || !Array.isArray(value[list])) return false;
  const keys = casing === "camel" ? ["page", "pageSize", "pageCount", "totalItems"] : casing === "threads" ? ["page_number", "page_size", "page_count", "total_threads"] : ["page", "page_size", "page_count", "total_items"];
  const [page, size, count, total] = keys.map(k => value[k]);
  return integer(page, 1) && integer(size, 1) && integer(count) && integer(total) &&
    value[list].length <= size && value[list].length <= total &&
    (total === 0 || count > 0) && (casing !== "threads" || integer(value.unread_messages));
}
/** Confirm only the mutation response shapes actually documented for supported endpoints. */
export function mutationConfirmed(method: string, path: string, value: unknown): boolean {
  if (!object(value) || value.error === true || value.success === false) return false;
  if (path === "/api/rates" || (method === "DELETE" && /^\/api\/reservations\/\d+$/.test(path))) return value.success === true;
  if (path === "/api/reservations" && method === "POST") return integer(value.id, 1);
  const createdElement = method === "POST" && /\/price-elements$/.test(path);
  const expectedStatus = createdElement || /\/send-message-to-guest$/.test(path) ? 201 : 200;
  return value.status === expectedStatus && typeof value.title === "string" && value.title.length > 0 &&
    (createdElement ? object(value.detail) && integer(value.detail.id, 1) : typeof value.detail === "string");
}

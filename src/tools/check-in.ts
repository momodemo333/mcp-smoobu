import { isError, type SmoobuClient } from "../smoobu-client.js";
import type { SmoobuOnlineCheckIn, SmoobuPaginatedResponse, SimplifiedCheckIn } from "../types.js";
import { validate, validatePageSize, validatePositiveInt } from "../validation.js";

export const listOnlineCheckInsTool = {
  name: "list_online_check_ins",
  description:
    "List online check-in records. Optionally filter by status. " +
    "Use page and pageSize for pagination (max 100 per page). " +
    "Smoobu API rate limit: 1000 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      page: { type: "number", description: "Page number (default: 1)" },
      pageSize: { type: "number", description: "Results per page (1-100, default: 25)" },
      status: { type: "string", description: "Filter by check-in status" },
    },
    required: [],
  },
};

function simplifyCheckIn(c: SmoobuOnlineCheckIn): SimplifiedCheckIn {
  return {
    id: c.id,
    bookingId: c.booking_id,
    status: c.status,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

export async function listOnlineCheckIns(
  client: SmoobuClient,
  params: Record<string, unknown>,
) {
  const error = validate(
    validatePositiveInt(params.page, "page"),
    validatePageSize(params.pageSize),
  );
  if (error) return error;

  const apiParams: Record<string, string | number> = {};
  if (params.page) apiParams.page = Number(params.page);
  if (params.pageSize) apiParams.pageSize = Number(params.pageSize);
  if (params.status) apiParams.status = String(params.status);

  const result = await client.request<SmoobuPaginatedResponse<SmoobuOnlineCheckIn>>(
    "/api/online-check-in",
    apiParams,
  );

  if (isError(result)) return result;

  const checkIns = (result.online_check_ins as SmoobuOnlineCheckIn[]) || [];

  return {
    totalItems: result.total_items,
    page: result.page,
    pageSize: result.page_size,
    pageCount: result.page_count,
    checkIns: checkIns.map(simplifyCheckIn),
  };
}

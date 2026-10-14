import type { SmoobuClient } from "../smoobu-client.js";
import type { SmoobuAddon } from "../types.js";
import { validate, validatePositiveInt } from "../validation.js";

export const listAddonsTool = {
  name: "list_addons",
  description:
    "List available service add-ons (extras, fees, services). " +
    "Optionally filter by apartment ID. Returns name, amount, tax, and configuration. " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      apartmentId: {
        type: "number",
        description: "Filter by apartment ID (optional)",
      },
    },
    required: [],
  },
};

export async function listAddons(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = validate(
    validatePositiveInt(params.apartmentId, "apartmentId"),
  );
  if (error) return error;

  return client.request<{ addons: SmoobuAddon[] }>(params.apartmentId ? "/api/addons/" + params.apartmentId : "/api/addons", ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]);
}

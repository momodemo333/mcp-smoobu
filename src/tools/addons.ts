import type { SmoobuClient } from "../smoobu-client.js";
import type { SmoobuAddon } from "../types.js";
import { validate, validatePositiveInt } from "../validation.js";

export const listAddonsTool = {
  name: "list_addons",
  description:
    "List available service add-ons (extras, fees, services). " +
    "Optionally filter by apartment ID. Returns name, amount, tax, and configuration. " +
    "Smoobu API rate limit: 1000 requests/minute.",
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

export async function listAddons(client: SmoobuClient, params: Record<string, unknown>) {
  const error = validate(
    validatePositiveInt(params.apartmentId, "apartmentId"),
  );
  if (error) return error;

  const apiParams: Record<string, number> = {};
  if (params.apartmentId) apiParams.apartmentId = Number(params.apartmentId);

  return client.request<SmoobuAddon[]>("/api/addons", apiParams);
}

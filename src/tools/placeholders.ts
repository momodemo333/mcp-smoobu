import { object, invalidResponse } from "../response-validation.js";
import { isError, type SmoobuClient } from "../smoobu-client.js";
import type { SmoobuCustomPlaceholder, SmoobuTranslation } from "../types.js";
import { validate, validatePositiveInt, validateRequired } from "../validation.js";

export const listCustomPlaceholdersTool = {
  name: "list_custom_placeholders",
  description:
    "List all custom placeholders (text variables used in message templates). " +
    "Returns ID, key, default value, and type. " +
    "Use get_custom_placeholder for full details including translations. " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export const getCustomPlaceholderTool = {
  name: "get_custom_placeholder",
  description:
    "Get a custom placeholder by ID, including all translations. " +
    "Use list_custom_placeholders first to find placeholder IDs. " +
    "Smoobu API rate limit: 700 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {
      customPlaceholderId: {
        type: "number",
        description: "The custom placeholder ID (positive integer)",
      },
    },
    required: ["customPlaceholderId"],
  },
};

export async function listCustomPlaceholders(client: SmoobuClient, signal?: AbortSignal) {
  return client.request<SmoobuCustomPlaceholder[]>("/api/custom-placeholders", ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]);
}

export async function getCustomPlaceholder(
  client: SmoobuClient,
  params: Record<string, unknown>, signal?: AbortSignal
) {
  const error = validate(
    validateRequired(params, ["customPlaceholderId"]),
    validatePositiveInt(params.customPlaceholderId, "customPlaceholderId"),
  );
  if (error) return error;

  const id = params.customPlaceholderId;

  const placeholder = await client.request<SmoobuCustomPlaceholder>(
    `/api/custom-placeholders/${id}`, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]
  );
  if (isError(placeholder)) return placeholder;

  const translations = await client.request<{ translations: SmoobuTranslation[] }>(
    `/api/custom-placeholders/${id}/translations`, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]
  );
  if (isError(translations)) return translations;

  if (!object(translations) || !Array.isArray(translations.translations)) return invalidResponse();
  return { ...placeholder, translations: translations.translations };
}

import { isError, type SmoobuClient } from "../smoobu-client.js";
import { validate, validatePositiveInt, validateRequired } from "../validation.js";
interface Webhook { id: number; webhookUrl: string; createdAt: string; }
// Callback paths/queries can embed secrets. Intentionally return origin only.
function safeWebhook(w: Webhook) {
  let callbackOrigin: string | null = null;
  try { callbackOrigin = new URL(w.webhookUrl).origin; } catch { /* upstream invalid URL */ }
  return { id: w.id, callbackOrigin, callbackUrlRedacted: true, createdAt: w.createdAt };
}
export async function listWebhooks(client: SmoobuClient, signal?: AbortSignal) {
  const result = await client.request<{ webhooks: Webhook[] }>("/api/users/webhooks", ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]);
  return isError(result) ? result : { webhooks: result.webhooks.map(safeWebhook), scope: "Only hooks visible to this authenticated key; not necessarily all account hooks." };
}
export async function getWebhook(client: SmoobuClient, params: Record<string, unknown>, signal?: AbortSignal) {
  const error = validate(validateRequired(params, ["webhookId"]), validatePositiveInt(params.webhookId, "webhookId"));
  if (error) return error;
  const result = await client.request<Webhook>("/api/users/webhooks/" + params.webhookId, ...signal ? [undefined, signal] as [undefined, AbortSignal] : [] as [undefined?, AbortSignal?]);
  return isError(result) ? result : safeWebhook(result);
}

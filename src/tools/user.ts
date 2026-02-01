import type { SmoobuClient } from "../smoobu-client.js";
import type { SmoobuUser } from "../types.js";

export const getUserTool = {
  name: "get_user",
  description:
    "Get the current Smoobu user profile (name, email). " +
    "Use this to verify the API connection or identify the account owner. " +
    "Smoobu API rate limit: 1000 requests/minute.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function getUser(client: SmoobuClient) {
  return client.request<SmoobuUser>("/api/me");
}

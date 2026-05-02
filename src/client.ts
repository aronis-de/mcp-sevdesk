import createClient from "openapi-fetch";
import type { paths } from "./generated/sevdesk-api.js";

export function createSevdeskClient(apiToken: string) {
  const client = createClient<paths>({
    baseUrl: "https://my.sevdesk.de/api/v1",
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  // Expose token for direct fetch calls
  (client as any).token = apiToken;

  return client;
}

export type SevdeskClient = ReturnType<typeof createSevdeskClient>;

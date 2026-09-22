import { localAuthProviderBaseUrl } from "@marinara-engine/shared";
import type { createConnectionsStorage } from "../storage/connections.storage.js";

/** Resolve a connection (handles "random" pool + baseUrl fallback). */
export async function resolveGameConnection(
  connections: Pick<ReturnType<typeof createConnectionsStorage>, "getWithKey" | "listRandomPool">,
  connId: string | null | undefined,
  chatConnectionId: string | null,
) {
  let id = connId ?? chatConnectionId;
  if (id === "random") {
    const pool = await connections.listRandomPool();
    if (!pool.length) throw new Error("No connections marked for the random pool");
    id = pool[Math.floor(Math.random() * pool.length)].id;
  }
  if (!id) throw new Error("No API connection configured");
  const conn = await connections.getWithKey(id);
  if (!conn) throw new Error("API connection not found");

  let baseUrl = conn.baseUrl;
  if (!baseUrl) {
    const { PROVIDERS } = await import("@marinara-engine/shared");
    const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
    baseUrl = providerDef?.defaultBaseUrl ?? "";
  }
  const localAuthBaseUrl = localAuthProviderBaseUrl(conn.provider);
  if (!baseUrl && localAuthBaseUrl) baseUrl = localAuthBaseUrl;
  if (!baseUrl) throw new Error("No base URL configured for this connection");

  return { conn, baseUrl };
}

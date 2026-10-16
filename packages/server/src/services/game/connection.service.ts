import { localAuthProviderBaseUrl } from "@marinara-engine/shared";
import { readChatModelOverride, resolveChatConnectionOrFallback } from "../generation/connection-resolution.js";
import type { createConnectionsStorage } from "../storage/connections.storage.js";

/** The chat whose Model is the default: its id, or the chat row (then its per-chat catalog pick applies). */
export type GameChatModel = string | null | { connectionId?: string | null; metadata?: unknown };

/** Resolve a connection (handles "random" pool + baseUrl fallback). */
export async function resolveGameConnection(
  connections: Pick<ReturnType<typeof createConnectionsStorage>, "getWithKey" | "listRandomPool"> &
    Partial<
      Pick<
        ReturnType<typeof createConnectionsStorage>,
        "getById" | "getFallbackForMain" | "getDefault" | "unavailableReason"
      >
    >,
  connId: string | null | undefined,
  chat: GameChatModel,
) {
  const chatConnectionId = typeof chat === "string" || chat === null ? chat : (chat.connectionId ?? null);
  let id = connId ?? chatConnectionId;
  if (id === "random") {
    const pool = await connections.listRandomPool();
    if (!pool.length) throw new Error("No connections marked for the random pool");
    id = pool[Math.floor(Math.random() * pool.length)].id;
  }
  if (!id) throw new Error("No API connection configured");
  // The chat's own Model runs the chat's catalog pick, whichever way its id arrived.
  const override = id === chatConnectionId && chat && typeof chat === "object" ? readChatModelOverride(chat) : null;
  const conn = await resolveChatConnectionOrFallback(connections, id, undefined, override);
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

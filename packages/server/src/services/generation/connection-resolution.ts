// ──────────────────────────────────────────────
// Resolve a chat's Model, falling back when its account blocks it
// ──────────────────────────────────────────────
import { logger } from "../../lib/logger.js";
import type { createConnectionsStorage } from "../storage/connections.storage.js";
import { notifyGenerationFallback, type GenerationFallbackNotifier } from "./fallback-notification.js";

type ConnectionsStorage = ReturnType<typeof createConnectionsStorage>;
// A caller that cannot name the other two methods (a narrow Pick) just gets no fallback.
type ChatConnectionStorage = Pick<ConnectionsStorage, "getWithKey"> &
  Partial<Pick<ConnectionsStorage, "getById" | "getFallbackForMain">>;

/**
 * `getWithKey` returns null for a Model that does not exist and for one its account blocks
 * (account off, or needs a key). A blocked Model still exists, so generation goes through the
 * main fallback Model and the user is told. A Model that does not exist stays null.
 */
export async function resolveChatConnectionOrFallback(
  connections: ChatConnectionStorage,
  connectionId: string,
  onFallback: GenerationFallbackNotifier = notifyGenerationFallback,
) {
  const connection = await connections.getWithKey(connectionId);
  if (connection) return connection;
  if (!connections.getById || !connections.getFallbackForMain) return null;
  if (!(await connections.getById(connectionId))) return null;

  const fallback = await connections.getFallbackForMain();
  if (!fallback) return null;
  logger.warn("[generate] Connection %s is unavailable; using main fallback %s", connectionId, fallback.id);
  try {
    await onFallback({
      category: "main",
      connectionId: fallback.id,
      connectionName: fallback.name?.trim() || fallback.id,
      model: fallback.model,
    });
  } catch (error) {
    logger.warn(error, "[generate] Failed to report main fallback activation");
  }
  return fallback;
}

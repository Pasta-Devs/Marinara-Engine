// ──────────────────────────────────────────────
// Resolve a chat's Model: its per-chat catalog pick, and the fallback when its Model cannot answer
// ──────────────────────────────────────────────
import { readChatModelOverride, type ChatModelOverride } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import type { createConnectionsStorage } from "../storage/connections.storage.js";
import { notifyGenerationFallback, type GenerationFallbackNotifier } from "./fallback-notification.js";

type ConnectionsStorage = ReturnType<typeof createConnectionsStorage>;
// A caller that cannot name the other methods (a narrow Pick) just gets no fallback.
type ChatConnectionStorage = Pick<ConnectionsStorage, "getWithKey"> &
  Partial<Pick<ConnectionsStorage, "getById" | "getFallbackForMain" | "getDefault" | "unavailableReason">>;

export { readChatModelOverride, type ChatModelOverride };

/** The fields a per-chat pick sets; everything else a saved Model tunes goes back to its neutral default. */
const NEUTRAL_TUNING = {
  defaultParameters: null,
  promptPresetId: null,
  enableCaching: "false",
  anthropicExtendedCacheTtl: "false",
  cachingAtDepth: 5,
  openrouterProvider: null,
  claudeFastMode: "false",
  maxStateTokens: null,
} as const;

/**
 * Run the override's model on the resolved Model's credentials and endpoint. Applies only to the Model the
 * override names, so a fallback Model is never changed. Limits come from the catalog (schema defaults when the
 * catalog has none); tuning is neutral, never taken from the saved Model it borrows the key from.
 */
export function applyChatModelOverride<T extends { id: string }>(conn: T, override: ChatModelOverride | null): T {
  if (!override || conn.id !== override.connectionId) return conn;
  return {
    ...conn,
    ...NEUTRAL_TUNING,
    name: override.name ?? override.model,
    model: override.model,
    maxContext: override.maxContext ?? 128000,
    maxTokensOverride: override.maxTokensOverride ?? null,
  };
}

/**
 * `getWithKey` returns null for a Model that does not exist and for one that is blocked (under import review,
 * or its Connection is off, under review or a hosted one without a key). Either way generation goes through a
 * fallback and the user is told why: a blocked Model uses the main fallback, a missing one the Main default
 * (then the main fallback). With `override`, the chat's own Model runs the per-chat catalog pick.
 */
export async function resolveChatConnectionOrFallback(
  connections: ChatConnectionStorage,
  connectionId: string | null,
  onFallback: GenerationFallbackNotifier = notifyGenerationFallback,
  override: ChatModelOverride | null = null,
) {
  const connection = connectionId ? await connections.getWithKey(connectionId) : null;
  if (connection) return applyChatModelOverride(connection, override);
  if (!connections.unavailableReason || !connections.getFallbackForMain) return null;
  // No id: the chat's Model was deleted (the reference sweep cleared it) or never set.
  const unavailable = connectionId
    ? await connections.unavailableReason(connectionId)
    : { reason: "deleted" as const, row: null };
  if (!unavailable) return null;

  let fallback = null;
  if (unavailable.reason === "deleted" && connections.getDefault) {
    const main = await connections.getDefault();
    if (main && main.id !== connectionId) fallback = await connections.getWithKey(main.id);
  }
  fallback ??= await connections.getFallbackForMain();
  if (!fallback) return null;
  logger.warn(
    "[generate] Connection %s is unavailable (%s); using fallback %s",
    connectionId,
    unavailable.reason,
    fallback.id,
  );
  try {
    await onFallback({
      category: "main",
      connectionId: fallback.id,
      connectionName: fallback.name?.trim() || fallback.id,
      model: fallback.model,
      reason: unavailable.reason,
      ...(connectionId ? { unavailableConnectionId: connectionId } : {}),
      ...(unavailable.row
        ? {
            unavailableName:
              override?.name ?? override?.model ?? (unavailable.row.name?.trim() || unavailable.row.model),
            ...(unavailable.row.accountId ? { unavailableAccountId: unavailable.row.accountId } : {}),
          }
        : {}),
    });
  } catch (error) {
    logger.warn(error, "[generate] Failed to report main fallback activation");
  }
  return fallback;
}

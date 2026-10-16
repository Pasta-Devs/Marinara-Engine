// ──────────────────────────────────────────────
// Model stars (concept decision 30)
// ──────────────────────────────────────────────
// The star is the only state a saved model has. A starred model is in "Your models"; removing the star removes the
// saved Model too, unless something keeps it: a role, settings of its own, a feature or agent that uses it, or it is
// the last chat Model that carries the Connection's catalog and favorites.
import {
  CHAT_MODEL_OVERRIDE_KEY,
  CHAT_RECENT_MODELS_KEY,
  DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY,
  FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY,
  MAX_PINNED_MODELS,
  isChatProvider,
  parsePinnedModels,
} from "@marinara-engine/shared";
import { eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { agentConfigs, apiConnections, chats } from "../../db/schema/index.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { hasOwnModelSettings } from "../storage/connections.storage.js";
import { logger } from "../../lib/logger.js";

type ConnectionRow = typeof apiConnections.$inferSelect;
export type ModelKeepReason = "starred" | "role" | "settings" | "in_use" | "last" | "not_chat";

const ROLE_FIELDS = ["isDefault", "defaultForAgents", "fallbackForMain", "fallbackForAgents", "useForRandom"] as const;

/** Whether a JSON text names the id; ids are unique, so a quoted match is a reference. */
const names = (raw: unknown, id: string) => typeof raw === "string" && raw.includes(JSON.stringify(id));

/** Chat metadata without the chat's own model pick and recent list: those move to a sibling Model on removal. */
function metadataWithoutPicks(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim().startsWith("{")) return "";
  try {
    const record = JSON.parse(raw) as Record<string, unknown>;
    delete record[CHAT_MODEL_OVERRIDE_KEY];
    delete record[CHAT_RECENT_MODELS_KEY];
    return JSON.stringify(record);
  } catch {
    return "";
  }
}

/** Why a saved Model stays without its star, or null when unstarring may remove it. */
export async function modelKeepReason(db: DB, row: ConnectionRow): Promise<ModelKeepReason | null> {
  if (!row.accountId || !isChatProvider(row.provider)) return "not_chat";
  if (parsePinnedModels(row.pinnedModels).includes(row.model)) return "starred";
  if (ROLE_FIELDS.some((field) => row[field] === "true")) return "role";
  if (hasOwnModelSettings(row)) return "settings";
  const peers = (await db.select().from(apiConnections).where(eq(apiConnections.accountId, row.accountId))).filter(
    (peer: ConnectionRow) => peer.id !== row.id,
  );
  if (!peers.some((peer: ConnectionRow) => isChatProvider(peer.provider))) return "last";
  if (peers.some((peer: ConnectionRow) => peer.embeddingConnectionId === row.id)) return "in_use";
  const settings = createAppSettingsStorage(db);
  if ((await settings.get(DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY)) === row.id) return "in_use";
  if (names(await settings.get(FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY), row.id)) return "in_use";
  for (const agent of await db.select().from(agentConfigs)) {
    if (agent.connectionId === row.id || names(agent.settings, row.id)) return "in_use";
  }
  for (const chat of await db.select().from(chats)) {
    if (names(metadataWithoutPicks(chat.metadata), row.id)) return "in_use";
  }
  return null;
}

const STARS_MIGRATION_MARKER_KEY = "connectionModelStarsMigrated";

/**
 * Upgrade step for decision 30: every Model saved before the star became its only state gets a star, so nothing
 * leaves "Your models" on its own. Runs once (marker in its own app-settings key); a later unstar stays unstarred.
 */
export async function starSavedModels(db: DB): Promise<number> {
  const settings = createAppSettingsStorage(db);
  if ((await settings.get(STARS_MIGRATION_MARKER_KEY)) === "true") return 0;
  // Stars are shared by the Models of one Connection and service, like `mirrorToAccountPeers` keeps them.
  const groups = new Map<string, ConnectionRow[]>();
  for (const row of (await db.select().from(apiConnections)) as ConnectionRow[]) {
    if (!row.accountId) continue;
    const key = `${row.accountId}\u0000${row.provider}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  let starred = 0;
  await db.transaction(async (tx) => {
    for (const rows of groups.values()) {
      const current = [...new Set(rows.flatMap((row) => parsePinnedModels(row.pinnedModels)))];
      const added = rows.map((row) => row.model.trim()).filter((model) => model && !current.includes(model));
      const next = [...new Set([...current, ...added])].slice(0, MAX_PINNED_MODELS);
      starred += next.length - current.length;
      for (const row of rows) {
        if (row.pinnedModels === JSON.stringify(next)) continue;
        await tx
          .update(apiConnections)
          .set({ pinnedModels: JSON.stringify(next) })
          .where(eq(apiConnections.id, row.id));
      }
    }
    await createAppSettingsStorage(tx).set(STARS_MIGRATION_MARKER_KEY, "true");
  });
  if (starred > 0) logger.info("[migration] Starred %d saved model(s) for the favorites-only model list", starred);
  return starred;
}

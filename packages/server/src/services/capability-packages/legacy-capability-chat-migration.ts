import type { DB } from "../../db/connection.js";
import { spatialContextSnapshots } from "../../db/schema/index.js";
import { logger } from "../../lib/logger.js";
import { createChatsStorage } from "../storage/chats.storage.js";

const CONVERSATION_GAME_PACKAGES = ["uno", "chess", "poker", "eightball", "tic-tac-toe", "rock-paper-scissors"];
const HIERARCHICAL_MAPS_ID = "hierarchical-maps";
const HIERARCHICAL_MAPS_MIGRATED_MODES = new Set(["roleplay", "game"]);

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function buildLegacyChatCapabilityPatch(chat: { mode: string; metadata: unknown }) {
  const metadata = parseMetadata(chat.metadata);
  const active = new Set(
    Array.isArray(metadata.activeAgentIds)
      ? metadata.activeAgentIds.filter((id): id is string => typeof id === "string")
      : [],
  );
  const before = active.size;
  if (chat.mode === "conversation") {
    for (const id of CONVERSATION_GAME_PACKAGES) active.add(id);
    if (metadata.conversationCallsEnabled === true) active.add("conversation-calls");
  }
  return active.size === before ? null : { activeAgentIds: [...active] };
}

function hasPersistedSpatialDefinition(metadata: Record<string, unknown>): boolean {
  const definition = metadata.spatialContext;
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) return false;
  const locations = (definition as Record<string, unknown>).locations;
  return Array.isArray(locations) && locations.length > 0;
}

export function buildHierarchicalMapsSelectionCorrectionPatch(
  chat: { mode: string; metadata: unknown },
  hasSpatialSnapshots: boolean,
) {
  if (!HIERARCHICAL_MAPS_MIGRATED_MODES.has(chat.mode)) return null;
  const metadata = parseMetadata(chat.metadata);
  const activeAgentIds = Array.isArray(metadata.activeAgentIds)
    ? metadata.activeAgentIds.filter((id): id is string => typeof id === "string")
    : [];
  if (!activeAgentIds.includes(HIERARCHICAL_MAPS_ID)) return null;
  if (hasSpatialSnapshots || hasPersistedSpatialDefinition(metadata)) return null;
  return { activeAgentIds: activeAgentIds.filter((id) => id !== HIERARCHICAL_MAPS_ID) };
}

/** Preserve implicitly available legacy features without overwriting per-chat opt-ins. */
export async function migrateLegacyChatCapabilitySelections(db: DB) {
  const chats = createChatsStorage(db);
  let updated = 0;
  for (const chat of await chats.list()) {
    const patch = buildLegacyChatCapabilityPatch(chat);
    if (!patch) continue;
    await chats.patchMetadata(chat.id, patch, { touchUpdatedAt: false });
    updated += 1;
  }
  logger.info("Migrated optional feature selections for %d existing chats", updated);
}

/** Undo v2.3.2's implicit Maps selection only where no persisted map exists. */
export async function correctLegacyHierarchicalMapsSelections(db: DB) {
  const chats = createChatsStorage(db);
  const snapshotRows = await db.select({ chatId: spatialContextSnapshots.chatId }).from(spatialContextSnapshots);
  const chatsWithSnapshots = new Set(snapshotRows.map((row) => row.chatId));
  let updated = 0;
  for (const chat of await chats.list()) {
    const patch = buildHierarchicalMapsSelectionCorrectionPatch(chat, chatsWithSnapshots.has(chat.id));
    if (!patch) continue;
    await chats.patchMetadata(chat.id, patch, { touchUpdatedAt: false });
    updated += 1;
  }
  logger.info("Corrected Hierarchical Maps selections for %d existing chats without map data", updated);
  return updated;
}

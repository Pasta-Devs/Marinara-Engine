import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createChatsStorage } from "../storage/chats.storage.js";

const CONVERSATION_GAME_PACKAGES = [
  "uno",
  "chess",
  "poker",
  "eightball",
  "tic-tac-toe",
  "rock-paper-scissors",
];

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
  } else if (chat.mode === "roleplay" || chat.mode === "game" || chat.mode === "visual_novel") {
    active.add("hierarchical-maps");
  }
  return active.size === before ? null : { activeAgentIds: [...active] };
}

/** Preserve exactly the feature availability older Engine builds gave existing chats. */
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

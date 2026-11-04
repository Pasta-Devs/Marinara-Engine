import type {
  CapabilityGameStateHost,
  CapabilityGameStateView,
  CharacterStat,
  PlayerStats,
  PresentCharacter,
} from "@marinara-engine/shared";
import { normalizeWorldCustomFields } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createGameStateStorage } from "../storage/game-state.storage.js";
import { projectGameSnapshotLocation, resolveOwnerSpatialProjection } from "../spatial-context/projection.js";

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T | null | undefined) ?? fallback;
  try {
    return (JSON.parse(value) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Capability API 1.818: the latest committed tracker state of a chat, read through the Engine instead of its table.
 * The location is the one the prompt gets: Hierarchical Maps' projection when that package runs for the chat.
 * Writes stay with the Engine trackers.
 */
export function createCapabilityGameStateHost(
  db: DB | undefined,
  permissions: readonly string[],
): CapabilityGameStateHost {
  return Object.freeze({
    async read(chatId: string): Promise<CapabilityGameStateView | null> {
      if (!permissions.includes("chat-read")) throw new Error("Reading tracker state requires chat-read permission.");
      if (!db || typeof chatId !== "string" || !chatId) return null;
      const chat = await createChatsStorage(db).getById(chatId);
      if (!chat) return null;
      const raw = await createGameStateStorage(db).getLatestCommitted(chatId);
      if (!raw) return null;
      const projection = await resolveOwnerSpatialProjection(chatId, {}, chat.metadata);
      const row = projectGameSnapshotLocation(raw, projection) ?? raw;
      return {
        chatId: row.chatId,
        messageId: row.messageId,
        swipeIndex: row.swipeIndex,
        date: row.date ?? null,
        time: row.time ?? null,
        location: row.location ?? null,
        weather: row.weather ?? null,
        temperature: row.temperature ?? null,
        worldCustomFields: normalizeWorldCustomFields(parseJson<unknown[]>(row.worldCustomFields, [])),
        presentCharacters: parseJson<PresentCharacter[]>(row.presentCharacters, []),
        playerStats: parseJson<PlayerStats | null>(row.playerStats, null),
        personaStats: parseJson<CharacterStat[] | null>(row.personaStats, null),
        createdAt: row.createdAt,
      };
    },
  });
}

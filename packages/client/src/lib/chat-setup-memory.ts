import type { Chat } from "@marinara-engine/shared";
import { parseChatMetadata } from "./chat-display";

/** Setup choices only: never messages, memories, summaries, trackers or character state. */
const META_KEYS = [
  "presetChoices",
  "activeLorebookIds",
  "excludedLorebookIds",
  "activeAgentIds",
  "enableAgents",
  "appliedChatPresetId",
  "background",
] as const;

const LIST_KEYS = new Set<string>(["activeLorebookIds", "excludedLorebookIds"]);

export interface SetupFields {
  personaId: string | null;
  connectionId: string | null;
  promptPresetId: string | null;
  metadata: Record<string, unknown>;
}

export interface SetupMemory extends SetupFields {
  /** Name shown in "Same setup as your last chat with <name>". */
  sourceName: string;
}

/** Newest earlier chat that was only with this character, in this mode (by updatedAt). */
export function pickSetupSource(
  chats: readonly Chat[] | undefined,
  characterId: string,
  mode: string,
  excludeChatId?: string,
): Chat | null {
  // Solo chats only, so a group chat's cast-specific lorebooks never leak into another character.
  const solo = (chats ?? []).filter(
    (chat) =>
      chat.id !== excludeChatId &&
      chat.mode === mode &&
      Array.isArray(chat.characterIds) &&
      chat.characterIds.length === 1 &&
      chat.characterIds[0] === characterId,
  );
  return solo.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] ?? null;
}

/** Pull the setup fields out of a chat. Absent metadata keys become null so a reset can clear them. */
export function readSetupFields(chat: Pick<Chat, "personaId" | "connectionId" | "promptPresetId" | "metadata">): SetupFields {
  const meta = parseChatMetadata(chat.metadata);
  return {
    personaId: chat.personaId ?? null,
    connectionId: chat.connectionId ?? null,
    promptPresetId: chat.promptPresetId ?? null,
    // The server rejects null for the lorebook id lists, so absent lists become [].
    metadata: Object.fromEntries(META_KEYS.map((key) => [key, meta[key] ?? (LIST_KEYS.has(key) ? [] : null)])),
  };
}

export function setupMemoryFrom(chat: Chat): SetupMemory {
  return { ...readSetupFields(chat), sourceName: chat.name };
}

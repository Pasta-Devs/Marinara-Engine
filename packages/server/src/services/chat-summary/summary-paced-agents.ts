// "Run with summaries": Lorebook Keeper and Card Evolution Auditor run on the same reply as a chat's automatic
// summary instead of on their own count, and approved card edits wait for the next summary turn. A summary turn
// already changes the prompt (Past Events, and with steps on, the messages it summarised leave Chat History), so
// putting the agents' changes on it too means the cache breaks once per summary instead of on several turns.
import {
  applyCharacterCardFieldUpdates,
  CARD_EVOLUTION_RUN_WITH_SUMMARIES_KEY,
  LOREBOOK_KEEPER_RUN_WITH_SUMMARIES_KEY,
  normalizeAdvancedMemorySettings,
  readHeldCardUpdates,
  type CharacterCardFieldUpdate,
  type HeldCardUpdate,
} from "@marinara-engine/shared";
import { effectiveAdvancedMemorySettings } from "../advanced-memory.js";
import { countConversationMessagesAfterSummaryAnchor } from "../conversation/auto-summary.service.js";
import {
  clampRoleplaySummaryInterval,
  isAutomaticRoleplaySummaryEnabled,
} from "../generation/roleplay-summary-runtime.js";
import { withCharacterUpdateQueue } from "../storage/characters.storage.js";

function parseCardData(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

type MessageLike = { id?: string | null; role?: string | null };

/** Whether automatic summaries run in this chat, so agents set to "Run with summaries" follow them. */
export function summariesPaceAgents(chatMetadata: Record<string, unknown>, chatMode: string): boolean {
  if (chatMode !== "roleplay" || !isAutomaticRoleplaySummaryEnabled(chatMetadata)) return false;
  const advancedMemory = effectiveAdvancedMemorySettings(
    chatMode,
    normalizeAdvancedMemorySettings(chatMetadata.advancedMemory),
  );
  return !advancedMemory.enabled;
}

export type SummaryPacedAgent = "lorebook-keeper" | "card-evolution-auditor";

const RUN_WITH_SUMMARIES_KEYS: Record<SummaryPacedAgent, string> = {
  "lorebook-keeper": LOREBOOK_KEEPER_RUN_WITH_SUMMARIES_KEY,
  "card-evolution-auditor": CARD_EVOLUTION_RUN_WITH_SUMMARIES_KEY,
};

/** Whether this agent follows the chat's summaries rather than its own run interval. */
export function agentRunsWithSummaries(
  agentType: SummaryPacedAgent,
  chatMetadata: Record<string, unknown>,
  chatMode: string,
): boolean {
  return chatMetadata[RUN_WITH_SUMMARIES_KEYS[agentType]] === true && summariesPaceAgents(chatMetadata, chatMode);
}

/**
 * Whether the automatic summary will run after the reply this generation writes. It counts the same way the summary
 * does once the reply is saved: conversation messages since the last automatic summary, the new reply included.
 * `messages` is the chat as stored before this reply (a regenerated reply is still in it and is replaced in place).
 */
export function automaticSummaryDueAfterReply(
  chatMetadata: Record<string, unknown>,
  messages: ReadonlyArray<{ id?: string | null; role: string }>,
  addsReply: boolean,
): boolean {
  const anchor =
    typeof chatMetadata.lastAutomaticSummaryMessageId === "string" ? chatMetadata.lastAutomaticSummaryMessageId : null;
  const since = countConversationMessagesAfterSummaryAnchor([...messages], anchor) + (addsReply ? 1 : 0);
  return since >= clampRoleplaySummaryInterval(chatMetadata.summaryRunInterval);
}

/**
 * Whether the next reply is a summary turn: the newest reply is the one the last automatic summary was made after,
 * and nothing has been written since. `messages` is the chat before the reply being generated or approved; pass
 * `ignoreTrailingUser` for a generation, whose own new message is already saved.
 */
export function summaryTurnIsNext(
  chatMetadata: Record<string, unknown>,
  messages: readonly MessageLike[],
  ignoreTrailingUser = false,
): boolean {
  const anchor = chatMetadata.lastAutomaticSummaryMessageId;
  if (typeof anchor !== "string" || !anchor) return false;
  const conversation = messages.filter((message) => message.role === "user" || message.role === "assistant");
  let last = conversation.length - 1;
  if (ignoreTrailingUser) {
    while (last >= 0 && conversation[last]!.role === "user") last -= 1;
  }
  return last >= 0 && conversation[last]!.id === anchor;
}

type ChatsStore = {
  patchMetadata(
    id: string,
    updater: (current: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>,
  ): Promise<unknown>;
};

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown } | null | undefined>;
  update(
    id: string,
    data: never,
    avatarPath?: string,
    options?: { versionSource?: string; versionReason?: string },
  ): Promise<unknown>;
};

/** Applies card edits to the stored card, re-checking them against it. Returns whether the card exists. */
export async function applyCardUpdates(
  characters: CharactersStore,
  characterId: string,
  agentName: string,
  updates: readonly CharacterCardFieldUpdate[],
  overrideStale: boolean,
): Promise<boolean> {
  return withCharacterUpdateQueue(characterId, async () => {
    const row = await characters.getById(characterId);
    if (!row) return false;
    const data = parseCardData(row.data);
    await characters.update(
      characterId,
      applyCharacterCardFieldUpdates(data, updates, overrideStale) as never,
      undefined,
      {
        versionSource: "agent",
        versionReason: `${agentName} card update`,
      },
    );
    return true;
  });
}

/** Takes the chat's held card edits out of its metadata and applies them, oldest first. */
export async function applyHeldCardUpdates(
  chats: ChatsStore,
  characters: CharactersStore,
  chatId: string,
): Promise<HeldCardUpdate[]> {
  let taken: HeldCardUpdate[] = [];
  await chats.patchMetadata(chatId, (current) => {
    taken = readHeldCardUpdates(current);
    return taken.length > 0 ? { heldCardUpdates: [] } : {};
  });
  for (const held of taken) {
    await applyCardUpdates(characters, held.characterId, held.agentName, held.updates, held.overrideStale);
  }
  return taken;
}

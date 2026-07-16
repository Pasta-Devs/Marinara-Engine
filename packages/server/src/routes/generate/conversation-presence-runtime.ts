import { normalizeTextForMatch } from "@marinara-engine/shared";

import type { DB } from "../../db/connection.js";
import {
  dailyCapForCharacter,
  getAutonomousDailyBudget,
} from "../../services/conversation/autonomous.service.js";
import {
  getDirectMessageDelay,
  getEffectiveCurrentStatus,
  getMentionDelay,
  getTodaySchedule,
  type WeekSchedule,
} from "../../services/conversation/schedule.service.js";
import {
  getEnabledConversationSchedules,
  parseConversationStatusOverrides,
} from "../../services/generation/conversation-context-utils.js";
import type { GenerationPromptMessage } from "../../services/generation/prompt-message-scope.js";
import { getActiveTurnGame } from "../../services/turn-games/turn-game-runner.service.js";
import { isMessageHiddenFromAI, parseExtra } from "./generate-route-utils.js";

export type ConversationPromptCharacterInfo = {
  charId: string;
  /** Base character-card name, retained for matching historical mentions. */
  name: string;
  /** Conversation-only name used in generated group speaker prefixes and UI events. */
  displayName: string;
  status: string;
  activity: string;
  todaySchedule: string;
};

type ConversationPresenceChatsStore = {
  patchMetadata(
    chatId: string,
    updater: (current: Record<string, unknown>) => Record<string, unknown>,
    options?: { touchUpdatedAt?: boolean },
  ): Promise<unknown>;
  listMessages(chatId: string): Promise<any[]>;
};

type ConversationPresenceCharactersStore = {
  getById(id: string): Promise<{ data?: unknown } | null>;
};

export async function resolveConversationPresenceRuntime(args: {
  db: DB;
  chatId: string;
  chatMeta: Record<string, unknown>;
  characterIds: string[];
  chars: ConversationPresenceCharactersStore;
  chats: ConversationPresenceChatsStore;
  actualNow?: Date;
  promptNow: Date;
  forCharacterId?: string | null;
  mentionedCharacterNames?: string[] | null;
  shouldAccountAutonomousGeneration: boolean;
  regenerateMessageId?: string | null;
  impersonate?: boolean;
  skipPresenceDelay?: boolean;
  supportsHiddenFromAI: boolean;
  contextMessageLimit: number | null | undefined;
  chatMessages: any[];
  finalMessages: GenerationPromptMessage[];
  abortSignal: AbortSignal;
  writeSse: (payload: unknown) => void;
  endSse: () => void;
  mapChatHistoryMessageForPrompt: (message: any) => Promise<GenerationPromptMessage>;
  resolveHistoryMessageMacros: (messages: GenerationPromptMessage[]) => GenerationPromptMessage[];
}): Promise<{
  ended: boolean;
  aborted: boolean;
  convoCharInfo: ConversationPromptCharacterInfo[];
  convoCharNames: string[];
  charNameList: string;
  isGroup: boolean;
  chatMessages: any[];
  finalMessages: GenerationPromptMessage[];
}> {
  const schedules = getEnabledConversationSchedules(args.chatMeta) as Record<string, WeekSchedule>;
  const statusOverrides = parseConversationStatusOverrides(args.chatMeta.conversationStatusOverrides);
  const convoCharInfo = await resolveConversationPromptCharacters({
    characterIds: args.characterIds,
    chars: args.chars,
    schedules,
    statusOverrides,
    actualNow: args.actualNow ?? new Date(),
    promptNow: args.promptNow,
  });

  persistConversationPresenceState(args.chats, args.chatId, convoCharInfo);

  const convoCharNames = convoCharInfo.map((character) => character.displayName);
  const charNameList = convoCharNames.length ? convoCharNames.join(", ") : "the character";
  const manualTargetCharId =
    typeof args.forCharacterId === "string" && args.characterIds.includes(args.forCharacterId)
      ? args.forCharacterId
      : null;
  const requestedMentionNames = new Set(
    (args.mentionedCharacterNames ?? []).map((name) => normalizeTextForMatch(name)),
  );
  const scopedConvoCharInfo = manualTargetCharId
    ? convoCharInfo.filter((character) => character.charId === manualTargetCharId)
    : requestedMentionNames.size > 0
      ? convoCharInfo.filter(
          (character) =>
            requestedMentionNames.has(normalizeTextForMatch(character.name)) ||
            requestedMentionNames.has(normalizeTextForMatch(character.displayName)),
        )
      : convoCharInfo;
  let respondingConvoCharInfo = scopedConvoCharInfo.length > 0 ? scopedConvoCharInfo : convoCharInfo;

  if (args.shouldAccountAutonomousGeneration && !args.regenerateMessageId && !args.impersonate) {
    const budget = getAutonomousDailyBudget(args.chatMeta);
    respondingConvoCharInfo = respondingConvoCharInfo.filter((character) => {
      const count = budget.counts[character.charId] ?? 0;
      const cap = dailyCapForCharacter(schedules[character.charId], args.chatMeta);
      return count < cap;
    });

    if (respondingConvoCharInfo.length === 0) {
      args.writeSse({ type: "done" });
      args.endSse();
      return buildPresenceResult({ ended: true, convoCharInfo, convoCharNames, charNameList, args });
    }
  }

  const respondingConvoCharNames = respondingConvoCharInfo.map((character) => character.displayName);
  const seatedGameCharIds = await resolveSeatedTurnGameCharacterIds(args.db, args.chatId);
  const effectiveStatus = (character: { charId: string; status: string }): string =>
    seatedGameCharIds.has(character.charId) ? "online" : character.status;

  const allOffline =
    respondingConvoCharInfo.length > 0 &&
    respondingConvoCharInfo.every((character) => effectiveStatus(character) === "offline");
  if (allOffline && !args.regenerateMessageId && !args.impersonate) {
    args.writeSse({ type: "offline", characters: respondingConvoCharNames });
    args.writeSse({ type: "done" });
    args.endSse();
    return buildPresenceResult({ ended: true, convoCharInfo, convoCharNames, charNameList, args });
  }

  let chatMessages = args.chatMessages;
  let finalMessages = args.finalMessages;
  if (!args.regenerateMessageId && !args.impersonate && !args.skipPresenceDelay) {
    const hasMentions = requestedMentionNames.size > 0 || !!manualTargetCharId;
    const worstStatus = respondingConvoCharInfo.reduce((worst, character) => {
      const rank = { online: 0, idle: 1, dnd: 2, offline: 3 } as Record<string, number>;
      const cStatus = effectiveStatus(character);
      return (rank[cStatus] ?? 0) > (rank[worst] ?? 0) ? cStatus : worst;
    }, "online");
    const delayMs = hasMentions
      ? getMentionDelay(worstStatus as "online" | "idle" | "dnd" | "offline")
      : respondingConvoCharInfo.reduce((maxDelay, character) => {
          const schedule = schedules[character.charId];
          return Math.max(
            maxDelay,
            getDirectMessageDelay(effectiveStatus(character) as "online" | "idle" | "dnd" | "offline", schedule),
          );
        }, 0);

    if (delayMs > 0) {
      args.writeSse({
        type: "delayed",
        characters: respondingConvoCharNames,
        characterIds: respondingConvoCharInfo.map((character) => character.charId),
        characterStatuses: Object.fromEntries(
          respondingConvoCharInfo.map((character) => [character.charId, character.status]),
        ),
        status: worstStatus,
        delayMs,
      });
      await waitForConversationPresenceDelay(delayMs, args.abortSignal);
      if (args.abortSignal.aborted) {
        return buildPresenceResult({
          ended: false,
          aborted: true,
          convoCharInfo,
          convoCharNames,
          charNameList,
          args,
          chatMessages,
          finalMessages,
        });
      }

      const refreshed = await args.chats.listMessages(args.chatId);
      const rStartIdx = findLatestConversationStartIndex(refreshed);
      const rScoped = rStartIdx > 0 ? refreshed.slice(rStartIdx) : refreshed;
      chatMessages = args.supportsHiddenFromAI ? rScoped.filter((message) => !isMessageHiddenFromAI(message)) : rScoped;
      if (args.contextMessageLimit && args.contextMessageLimit > 0 && chatMessages.length > args.contextMessageLimit) {
        chatMessages = chatMessages.slice(-args.contextMessageLimit);
      }
      finalMessages = [];
      for (const message of chatMessages) {
        finalMessages.push(await args.mapChatHistoryMessageForPrompt(message));
      }
      finalMessages = args.resolveHistoryMessageMacros(finalMessages);
    }
    args.writeSse({ type: "typing", characters: respondingConvoCharNames });
  }

  if (args.regenerateMessageId) {
    args.writeSse({ type: "typing", characters: convoCharNames });
  }

  return buildPresenceResult({ ended: false, convoCharInfo, convoCharNames, charNameList, args, chatMessages, finalMessages });
}

async function resolveConversationPromptCharacters(args: {
  characterIds: string[];
  chars: ConversationPresenceCharactersStore;
  schedules: Record<string, WeekSchedule>;
  statusOverrides: ReturnType<typeof parseConversationStatusOverrides>;
  actualNow: Date;
  promptNow: Date;
}): Promise<ConversationPromptCharacterInfo[]> {
  const convoCharInfo: ConversationPromptCharacterInfo[] = [];
  for (const cid of args.characterIds) {
    const charRow = await args.chars.getById(cid);
    if (!charRow) continue;

    let data: unknown = charRow.data;
    if (typeof charRow.data === "string") {
      try {
        data = JSON.parse(charRow.data);
      } catch {
        data = null;
      }
    }
    const override = args.statusOverrides[cid];
    const fallback = getEffectiveCurrentStatus(undefined, override, args.actualNow, "", args.promptNow);
    let status = fallback.status;
    let activity = fallback.activity;
    let todaySchedule = "";
    const schedule = args.schedules[cid];
    if (schedule) {
      const derived = getEffectiveCurrentStatus(schedule, override, args.actualNow, "free time", args.promptNow);
      status = derived.status;
      activity = derived.activity;
      todaySchedule = getTodaySchedule(schedule, args.promptNow);
    }
    const characterData = data as { name?: string; extensions?: Record<string, unknown> } | null;
    const name = characterData?.name?.trim() || "Unknown";
    const convoDisplayName =
      typeof characterData?.extensions?.convoDisplayName === "string"
        ? characterData.extensions.convoDisplayName.trim()
        : "";
    convoCharInfo.push({
      charId: cid,
      name,
      displayName: convoDisplayName || name,
      status,
      activity,
      todaySchedule,
    });
  }
  return convoCharInfo;
}

function persistConversationPresenceState(
  chats: ConversationPresenceChatsStore,
  chatId: string,
  convoCharInfo: ConversationPromptCharacterInfo[],
): void {
  if (convoCharInfo.length === 0) return;
  void chats
    .patchMetadata(
      chatId,
      (current) => ({
        conversationCharacterStatuses: {
          ...(current.conversationCharacterStatuses ?? {}),
          ...Object.fromEntries(
            convoCharInfo.map((character) => [
              character.charId,
              { status: character.status, activity: character.activity },
            ]),
          ),
        },
      }),
      { touchUpdatedAt: false },
    )
    .catch(() => {});
}

async function resolveSeatedTurnGameCharacterIds(db: DB, chatId: string): Promise<Set<string>> {
  const activeGameForSchedule = await getActiveTurnGame(db, chatId);
  const seatOrder = activeGameForSchedule?.state?.seatOrder;
  return Array.isArray(seatOrder)
    ? new Set(seatOrder.filter((value: unknown): value is string => typeof value === "string"))
    : new Set<string>();
}

async function waitForConversationPresenceDelay(delayMs: number, abortSignal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    if (abortSignal.aborted) {
      resolve();
      return;
    }
    const timeout = setTimeout(resolve, delayMs);
    abortSignal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

function findLatestConversationStartIndex(messages: any[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const extra = parseExtra(messages[i]!.extra);
    if (extra.isConversationStart) return i;
  }
  return 0;
}

function buildPresenceResult(args: {
  ended: boolean;
  aborted?: boolean;
  convoCharInfo: ConversationPromptCharacterInfo[];
  convoCharNames: string[];
  charNameList: string;
  args: { chatMessages: any[]; finalMessages: GenerationPromptMessage[] };
  chatMessages?: any[];
  finalMessages?: GenerationPromptMessage[];
}) {
  return {
    ended: args.ended,
    aborted: args.aborted === true,
    convoCharInfo: args.convoCharInfo,
    convoCharNames: args.convoCharNames,
    charNameList: args.charNameList,
    isGroup: args.convoCharNames.length > 1,
    chatMessages: args.chatMessages ?? args.args.chatMessages,
    finalMessages: args.finalMessages ?? args.args.finalMessages,
  };
}

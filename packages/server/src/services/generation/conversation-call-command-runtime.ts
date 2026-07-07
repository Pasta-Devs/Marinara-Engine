import type { ChatMode } from "@marinara-engine/shared";

import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createConversationCallsStorage } from "../storage/conversation-calls.storage.js";
import type { CallCommand, CharacterCommand } from "../conversation/character-commands.js";
import { isConversationCommandEnabled } from "./conversation-command-runtime.js";

type ChatsStore = {
  getById(id: string): Promise<{ metadata?: unknown } | null>;
  createMessagesBatch(chatId: string, messages: Array<Record<string, unknown>>): Promise<unknown>;
};

export async function handleConversationCallCommand(args: {
  command: CharacterCommand;
  characterId: string | null;
  chatId: string;
  chatMode: ChatMode;
  messageId?: string | null;
  db: DB;
  chats: ChatsStore;
  sendRingingEvent: (data: Record<string, unknown>) => void;
}): Promise<boolean> {
  if (args.command.type !== "call") return false;
  if (args.chatMode !== "conversation") return true;

  const command = args.command as CallCommand;
  const freshChat = await args.chats.getById(args.chatId);
  const freshMeta = parseRecord(freshChat?.metadata) ?? {};
  if (freshMeta.characterCommands === false || !isConversationCommandEnabled(freshMeta, "call")) {
    logger.debug("[commands] Ignored call command because calls are disabled for chat %s", args.chatId);
    return true;
  }

  const ttsSettings = await loadTtsSettings(args.db);
  if (ttsSettings.callAudioEnabled !== true) {
    logger.debug("[commands] Ignored call command because Conversation call audio is globally disabled");
    return true;
  }

  const callStore = createConversationCallsStorage(args.db);
  const existingActive = await callStore.getActiveForChat(args.chatId);
  const existingRinging = await callStore.getRingingForChat(args.chatId);
  const session =
    existingActive ??
    existingRinging ??
    (await callStore.createSession({
      chatId: args.chatId,
      mode: "audio",
      initiator: "character",
      initiatorCharacterId: args.characterId,
      metadata: {
        reason: command.reason ?? null,
        greeting: command.greeting ?? null,
        sourceMessageId: args.messageId ?? null,
      },
    }));

  if (session && !existingActive && !existingRinging) {
    await args.chats.createMessagesBatch(args.chatId, [
      {
        role: "system",
        characterId: args.characterId,
        content: "Incoming call",
        extra: {
          displayText: null,
          isGenerated: true,
          tokenCount: null,
          generationInfo: null,
          conversationCallEvent: {
            callId: session.id,
            status: session.status,
            mode: session.mode,
            initiator: session.initiator,
            reason: command.reason ?? null,
            greeting: command.greeting ?? null,
            sourceMessageId: args.messageId ?? null,
          },
        },
      },
    ]);
  }

  if (session) {
    args.sendRingingEvent({ session, reason: command.reason ?? null, characterId: args.characterId });
    logger.info("[commands] Conversation call ringing for chat %s", args.chatId);
  }

  return true;
}

async function loadTtsSettings(db: DB): Promise<Record<string, unknown>> {
  const ttsSettingsRaw = await createAppSettingsStorage(db).get("tts");
  if (!ttsSettingsRaw || typeof ttsSettingsRaw !== "string") return {};
  try {
    const parsed = JSON.parse(ttsSettingsRaw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

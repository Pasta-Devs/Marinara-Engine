import { normalizeTextForMatch } from "@marinara-engine/shared";

import { logger } from "../../lib/logger.js";
import { stripConversationPromptTimestamps } from "../conversation/transcript-sanitize.js";
import {
  type CharacterCommand,
  type InfluenceCommand,
  type MemoryCommand,
  type NoteCommand,
} from "../conversation/character-commands.js";

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown } | null>;
  list(): Promise<Array<{ id: string; data: unknown }>>;
  update(id: string, data: Record<string, unknown>): Promise<unknown>;
};

type ChatsStore = {
  getById(id: string): Promise<{ connectedChatId?: unknown } | null>;
  createInfluence(sourceChatId: string, targetChatId: string, content: string, anchorMessageId?: string): Promise<unknown>;
  createNote(sourceChatId: string, targetChatId: string, content: string, anchorMessageId?: string): Promise<unknown>;
};

type CharacterMemory = {
  from: string;
  fromCharId: string;
  summary: string;
  createdAt: string;
};

export async function handleConversationSideEffectCommand(args: {
  command: CharacterCommand;
  characterId: string | null;
  chatId: string;
  messageId?: string | null;
  chars: CharactersStore;
  chats: ChatsStore;
}): Promise<boolean> {
  if (args.command.type === "memory") {
    await handleMemoryCommand(args.command as MemoryCommand, args);
    return true;
  }
  if (args.command.type === "influence") {
    await handleInfluenceCommand(args.command as InfluenceCommand, args);
    return true;
  }
  if (args.command.type === "note") {
    await handleNoteCommand(args.command as NoteCommand, args);
    return true;
  }
  return false;
}

async function handleMemoryCommand(
  command: MemoryCommand,
  args: Parameters<typeof handleConversationSideEffectCommand>[0],
): Promise<void> {
  const targetName = normalizeTextForMatch(command.target);

  const srcCharRow = args.characterId ? await args.chars.getById(args.characterId) : null;
  const srcCharData = parseRecord(srcCharRow?.data);
  const srcCharName = typeof srcCharData?.name === "string" && srcCharData.name.trim() ? srcCharData.name : "Unknown";

  const allCharsList = await args.chars.list();
  const targetChar = allCharsList.find((character) => {
    const data = parseRecord(character.data);
    return typeof data?.name === "string" && normalizeTextForMatch(data.name) === targetName;
  });

  if (!targetChar) {
    logger.warn('[commands] Memory target character "%s" not found', command.target);
    return;
  }

  const targetData = parseRecord(targetChar.data) ?? {};
  const extensions = { ...(parseRecord(targetData.extensions) ?? {}) };
  const memories = Array.isArray(extensions.characterMemories)
    ? ([...extensions.characterMemories] as CharacterMemory[])
    : [];

  memories.push({
    from: srcCharName,
    fromCharId: args.characterId ?? "",
    summary: command.summary,
    createdAt: new Date().toISOString(),
  });

  extensions.characterMemories = memories;
  await args.chars.update(targetChar.id, { extensions });

  const targetDisplayName =
    typeof targetData.name === "string" && targetData.name.trim() ? targetData.name : targetChar.id;
  logger.info(
    '[commands] Memory created: "%s" -> "%s" (summaryLength=%d)',
    srcCharName,
    targetDisplayName,
    command.summary.length,
  );
}

async function handleInfluenceCommand(
  command: InfluenceCommand,
  args: Parameters<typeof handleConversationSideEffectCommand>[0],
): Promise<void> {
  const freshChat = await args.chats.getById(args.chatId);
  const connectedId = typeof freshChat?.connectedChatId === "string" ? freshChat.connectedChatId : null;
  if (!connectedId) {
    logger.warn("[commands] Influence command used but no connected chat");
    return;
  }

  const influenceContent = stripConversationPromptTimestamps(command.content);
  if (!influenceContent) return;

  await args.chats.createInfluence(args.chatId, connectedId, influenceContent, args.messageId ?? undefined);
  logger.info(
    "[commands] OOC influence queued for connected chat %s (contentLength=%d)",
    connectedId,
    influenceContent.length,
  );
}

async function handleNoteCommand(
  command: NoteCommand,
  args: Parameters<typeof handleConversationSideEffectCommand>[0],
): Promise<void> {
  const freshChat = await args.chats.getById(args.chatId);
  const connectedId = typeof freshChat?.connectedChatId === "string" ? freshChat.connectedChatId : null;
  if (!connectedId) {
    logger.warn("[commands] Note command used but no connected chat");
    return;
  }

  const noteContent = stripConversationPromptTimestamps(command.content);
  if (!noteContent) return;

  await args.chats.createNote(args.chatId, connectedId, noteContent, args.messageId ?? undefined);
  logger.info(
    "[commands] Conversation note saved for connected chat %s (contentLength=%d)",
    connectedId,
    noteContent.length,
  );
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

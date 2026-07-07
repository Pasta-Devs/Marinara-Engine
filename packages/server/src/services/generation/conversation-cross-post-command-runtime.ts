import { normalizeTextForMatch } from "@marinara-engine/shared";

import { logger } from "../../lib/logger.js";
import type { CharacterCommand, CrossPostCommand } from "../conversation/character-commands.js";

type ChatRow = {
  id: string;
  name?: string | null;
  mode?: string | null;
};

type ChatsStore = {
  list(): Promise<ChatRow[]>;
  getMessage(id: string): Promise<{ content?: unknown } | null>;
  createMessage(input: {
    chatId: string;
    role: string;
    characterId: string | null;
    content: string;
  }): Promise<unknown>;
  removeMessage(id: string): Promise<unknown>;
};

export async function handleConversationCrossPostCommand(args: {
  command: CharacterCommand;
  characterId: string | null;
  chatId: string;
  messageId?: string | null;
  fullResponse: string;
  chats: ChatsStore;
  sendCrossPost: (data: Record<string, unknown>) => void;
}): Promise<boolean> {
  if (args.command.type !== "cross_post") return false;
  const command = args.command as CrossPostCommand;
  const targetName = normalizeTextForMatch(command.target);

  const allChatsList = await args.chats.list();
  const targetChat = allChatsList.find(
    (chat) =>
      chat.mode === "conversation" &&
      chat.id !== args.chatId &&
      (normalizeTextForMatch(chat.name ?? "").includes(targetName) || chat.id === command.target),
  );

  if (!targetChat) {
    logger.warn('[commands] Cross-post target "%s" not found', command.target);
    return true;
  }

  const msgRow = args.messageId ? await args.chats.getMessage(args.messageId) : null;
  const msgContent = typeof msgRow?.content === "string" ? msgRow.content : args.fullResponse;
  await args.chats.createMessage({
    chatId: targetChat.id,
    role: "assistant",
    characterId: args.characterId,
    content: msgContent,
  });

  if (args.messageId) {
    await args.chats.removeMessage(args.messageId);
  }

  args.sendCrossPost({
    targetChatId: targetChat.id,
    targetChatName: targetChat.name,
    sourceChatId: args.chatId,
    characterId: args.characterId,
  });
  logger.info('[commands] Cross-posted message to chat "%s" (%s)', targetChat.name, targetChat.id);

  return true;
}

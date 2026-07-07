import { logger } from "../../lib/logger.js";
import { parseExtra, isMessageHiddenFromAI } from "../../routes/generate/generate-route-utils.js";
import { recordAssistantActivity, recordUserActivity } from "../conversation/autonomous.service.js";
import type { CharacterCommand, DirectMessageCommand } from "../conversation/character-commands.js";
import { stripConversationPromptTimestamps } from "../conversation/transcript-sanitize.js";
import { parseChatCharacterIdsForDm } from "./roleplay-dm-utils.js";

type ChatRow = {
  id: string;
  name?: string | null;
  mode?: string | null;
  metadata?: unknown;
  characterIds?: unknown;
  personaId?: unknown;
  connectionId?: unknown;
  connectedChatId?: unknown;
};

type MessageRow = {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  extra?: unknown;
};

type ChatsStore = {
  getById(id: string): Promise<ChatRow | null>;
  list(): Promise<ChatRow[]>;
  listMessages(chatId: string): Promise<MessageRow[]>;
  create(input: {
    name: string;
    mode: string;
    characterIds: string[];
    groupId: string | null;
    personaId: string | null;
    promptPresetId: string | null;
    connectionId: string | null;
  }): Promise<ChatRow | null>;
  createMessage(input: {
    chatId: string;
    role: string;
    characterId: string | null;
    content: string;
  }): Promise<{ id?: unknown } | null>;
  updateMessageExtra(id: string, partial: Record<string, unknown>): Promise<unknown>;
  patchMetadata(id: string, patch: Record<string, unknown>): Promise<unknown>;
  remove(id: string): Promise<unknown>;
};

export async function handleRoleplayDmCommand(args: {
  command: CharacterCommand;
  chatId: string;
  sourceChat: ChatRow;
  messageId?: string | null;
  allChatMessages: MessageRow[];
  chats: ChatsStore;
  sendAssistantAction: (data: Record<string, unknown>) => void;
}): Promise<boolean> {
  if (args.command.type !== "dm") return false;
  const command = args.command as DirectMessageCommand;

  try {
    await runRoleplayDmCommand(command, args);
  } catch (err) {
    logger.error(err, "[commands] Roleplay DM creation failed");
  }

  return true;
}

async function runRoleplayDmCommand(
  command: DirectMessageCommand,
  args: Parameters<typeof handleRoleplayDmCommand>[0],
): Promise<void> {
  const messageText = stripConversationPromptTimestamps(command.message).trim().slice(0, 4000);
  const targetCharId = command.resolvedCharacterId ?? null;
  const targetName = command.resolvedCharacterName ?? command.character.trim();

  if (!targetCharId) {
    logger.warn('[commands] DM target character "%s" not found', command.character);
    return;
  }
  if (!messageText) return;

  const sourceUserMessage = [...args.allChatMessages]
    .reverse()
    .find((message) => message.role === "user" && !isMessageHiddenFromAI(message));
  const sourceUserText = sourceUserMessage
    ? stripConversationPromptTimestamps(String(sourceUserMessage.content ?? "")).trim().slice(0, 4000)
    : "";

  const ensureSourceUserMessage = async (targetChatId: string, dedupePerTarget: boolean) => {
    if (!sourceUserMessage?.id || !sourceUserText) return null;

    const targetMessages = await args.chats.listMessages(targetChatId);
    const alreadyMirrored = targetMessages.some((message) => {
      const extra = parseExtra(message.extra) as Record<string, unknown>;
      if (
        extra.roleplayDmSourceChatId !== args.chatId ||
        extra.roleplayDmSourceUserMessageId !== sourceUserMessage.id
      ) {
        return false;
      }
      return !dedupePerTarget || extra.roleplayDmTargetCharacterId === targetCharId;
    });
    if (alreadyMirrored) return null;

    const userMsg = await args.chats.createMessage({
      chatId: targetChatId,
      role: "user",
      characterId: null,
      content: sourceUserText,
    });
    if (typeof userMsg?.id === "string") {
      await args.chats.updateMessageExtra(userMsg.id, {
        roleplayDmSourceChatId: args.chatId,
        roleplayDmSourceUserMessageId: sourceUserMessage.id,
        roleplayDmTargetCharacterId: targetCharId,
      });
    }
    recordUserActivity(targetChatId);
    return userMsg;
  };

  const freshChat = await args.chats.getById(args.chatId);
  const connectedId = typeof freshChat?.connectedChatId === "string" ? freshChat.connectedChatId : null;
  const connectedChat = connectedId ? await args.chats.getById(connectedId) : null;
  const linkedConversationId = connectedChat?.mode === "conversation" ? connectedChat.id : null;

  if (linkedConversationId) {
    const sourceUserDmMessage = await ensureSourceUserMessage(linkedConversationId, false);
    const dmMessage = await args.chats.createMessage({
      chatId: linkedConversationId,
      role: "assistant",
      characterId: targetCharId,
      content: messageText,
    });
    recordAssistantActivity(linkedConversationId, targetCharId);

    args.sendAssistantAction({
      action: "dm_posted",
      chatId: linkedConversationId,
      mode: "conversation",
      characterName: targetName,
      sourceChatId: args.chatId,
      sourceMessageId: args.messageId || null,
      sourceUserMessageId: sourceUserMessage?.id ?? null,
      userMessageId: sourceUserDmMessage?.id ?? null,
      messageId: dmMessage?.id ?? null,
    });
    logger.info(
      '[commands] Roleplay DM from "%s" posted to linked conversation %s from chat %s',
      targetName,
      linkedConversationId,
      args.chatId,
    );
    return;
  }

  const allChatsList = await args.chats.list();
  const existingDmChat = allChatsList.find((candidate) => {
    if (candidate.mode !== "conversation" || candidate.id === args.chatId) return false;
    const meta = parseExtra(candidate.metadata) as Record<string, unknown>;
    if (meta.dmOriginChatId !== args.chatId) return false;
    if (typeof meta.dmTargetCharacterId === "string" && meta.dmTargetCharacterId !== targetCharId) return false;
    return parseChatCharacterIdsForDm(candidate.characterIds).includes(targetCharId);
  });

  const createdNewChat = !existingDmChat;
  const targetChat =
    existingDmChat ??
    (await args.chats.create({
      name: `DM with ${targetName}`,
      mode: "conversation",
      characterIds: [targetCharId],
      groupId: null,
      personaId: typeof args.sourceChat.personaId === "string" ? args.sourceChat.personaId : null,
      promptPresetId: null,
      connectionId: typeof args.sourceChat.connectionId === "string" ? args.sourceChat.connectionId : null,
    }));
  if (!targetChat) throw new Error("Failed to create DM conversation");

  let sourceUserDmMessage: Awaited<ReturnType<ChatsStore["createMessage"]>> | null = null;
  let dmMessage: Awaited<ReturnType<ChatsStore["createMessage"]>> | null = null;
  try {
    await args.chats.patchMetadata(targetChat.id, {
      dmOriginChatId: args.chatId,
      dmOriginChatName: args.sourceChat.name ?? null,
      dmOriginMessageId: args.messageId || null,
      dmSourceUserMessageId: sourceUserMessage?.id ?? null,
      dmTargetCharacterId: targetCharId,
      roleplayDmThread: true,
    });
    sourceUserDmMessage = await ensureSourceUserMessage(targetChat.id, true);
    dmMessage = await args.chats.createMessage({
      chatId: targetChat.id,
      role: "assistant",
      characterId: targetCharId,
      content: messageText,
    });
    recordAssistantActivity(targetChat.id, targetCharId);
  } catch (dmWriteErr) {
    if (createdNewChat) {
      try {
        await args.chats.remove(targetChat.id);
        logger.warn("[commands] Removed incomplete Roleplay DM conversation %s after failed setup", targetChat.id);
      } catch (cleanupErr) {
        logger.error(cleanupErr, "[commands] Failed to remove incomplete Roleplay DM conversation %s", targetChat.id);
      }
    }
    throw dmWriteErr;
  }

  args.sendAssistantAction({
    action: createdNewChat ? "chat_created" : "dm_posted",
    chatId: targetChat.id,
    chatName: targetChat.name ?? `DM with ${targetName}`,
    mode: "conversation",
    characterName: targetName,
    sourceChatId: args.chatId,
    sourceMessageId: args.messageId || null,
    sourceUserMessageId: sourceUserMessage?.id ?? null,
    userMessageId: sourceUserDmMessage?.id ?? null,
    messageId: dmMessage?.id ?? null,
  });
  logger.info(
    createdNewChat
      ? '[commands] Roleplay DM conversation created with "%s" (%s) from chat %s'
      : '[commands] Roleplay DM from "%s" reused conversation %s from chat %s',
    targetName,
    targetChat.id,
    args.chatId,
  );
}

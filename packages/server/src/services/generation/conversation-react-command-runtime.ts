import {
  normalizeTextForMatch,
  parseGroupedSpeakerSegments,
  stripLeadingMessageTimestamps,
  type ChatMode,
} from "@marinara-engine/shared";

import { logger } from "../../lib/logger.js";
import {
  addMessageReactor,
  buildConversationCustomEmojiKey,
  buildGlobalCustomEmojiUrl,
  REACTION_ANNOTATION_CONTENT_CAP,
} from "../../routes/generate/conversation-custom-assets.js";
import { parseExtra } from "../../routes/generate/generate-route-utils.js";
import type { CharacterCommand, ReactCommand } from "../conversation/character-commands.js";

type MessageRow = {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  characterId?: unknown;
  extra?: unknown;
  activeSwipeIndex?: number | null;
};

type ChatsStore = {
  getMessage(id: string): Promise<MessageRow | null>;
  getSwipes(messageId: string): Promise<Array<{ index: number }>>;
  updateMessageExtra(id: string, partial: Record<string, unknown>): Promise<unknown>;
  updateSwipeExtra(messageId: string, swipeIndex: number, partial: Record<string, unknown>): Promise<unknown>;
};

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown } | null>;
};

type CustomEmojiStore = {
  getByName(name: string): Promise<{ filePath?: unknown } | null>;
};

type ChatMember = { id: string; name: string };
type SegmentTarget = { segment: number; speaker: string | null };

export async function handleConversationReactCommand(args: {
  command: CharacterCommand;
  characterId: string | null;
  sourceMessageId?: string | null;
  chatMode: ChatMode;
  chatMessages: MessageRow[];
  personaId: string | null;
  personaName: string;
  conversationCustomEmojiUrlByName: Map<string, string>;
  customEmojisStore: CustomEmojiStore;
  chars: CharactersStore;
  chats: ChatsStore;
  getReactChatMembers: () => Promise<ChatMember[]>;
}): Promise<boolean> {
  if (args.command.type !== "react") return false;
  const command = args.command as ReactCommand;
  if (args.chatMode !== "conversation") {
    logger.debug("[react/conversation] Ignored react command outside conversation mode");
    return true;
  }
  if (!args.characterId || !command.emoji) return true;

  const imageUrl = await resolveCustomEmojiImageUrl(command, args);
  const target = await resolveReactionTarget(command, args);
  if (!target) return true;

  const targetMsg =
    target.prefetchedMessage && target.id === target.prefetchedMessage.id
      ? target.prefetchedMessage
      : await args.chats.getMessage(target.id);
  if (!targetMsg) return true;

  const ex = parseExtra(targetMsg.extra);
  const reactions = addMessageReactor(ex.reactions, command.emoji, args.characterId, imageUrl, target.segmentTarget);
  await args.chats.updateMessageExtra(target.id, { reactions });

  const targetSwipes = await args.chats.getSwipes(target.id);
  for (const swipe of targetSwipes) {
    if (swipe.index === targetMsg.activeSwipeIndex) continue;
    await args.chats.updateSwipeExtra(target.id, swipe.index, { reactions });
  }

  logger.info(
    "[react/conversation] %s reacted with %s on message %s%s",
    args.characterId,
    command.emoji,
    target.id,
    target.segmentTarget ? ` (segment ${target.segmentTarget.segment})` : "",
  );

  return true;
}

async function resolveCustomEmojiImageUrl(
  command: ReactCommand,
  args: Parameters<typeof handleConversationReactCommand>[0],
): Promise<string | null> {
  const customName = command.emoji.match(/^:([a-zA-Z0-9_]+):$/)?.[1];
  if (!customName) return null;

  const emojiLookupKeys = [
    args.characterId ? buildConversationCustomEmojiKey("character", args.characterId, customName) : null,
    args.personaId ? buildConversationCustomEmojiKey("persona", args.personaId, customName) : null,
    buildConversationCustomEmojiKey("global", null, customName),
  ].filter((key): key is string => Boolean(key));

  for (const key of emojiLookupKeys) {
    const imageUrl = args.conversationCustomEmojiUrlByName.get(key) ?? null;
    if (imageUrl) return imageUrl;
  }

  const row = await args.customEmojisStore.getByName(customName);
  return row?.filePath ? buildGlobalCustomEmojiUrl(String(row.filePath)) : null;
}

async function resolveReactionTarget(
  command: ReactCommand,
  args: Parameters<typeof handleConversationReactCommand>[0],
): Promise<{ id: string; segmentTarget: SegmentTarget | null; prefetchedMessage: MessageRow | null } | null> {
  let targetId = [...args.chatMessages].reverse().find((m) => m.role === "user")?.id;
  let segmentTarget: SegmentTarget | null = null;
  let prefetchedMessage: MessageRow | null = null;

  if (command.targetCharacter) {
    const chatMembers = await args.getReactChatMembers();
    const wanted = normalizeTextForMatch(command.targetCharacter);
    const targetChar = chatMembers.find((m) => normalizeTextForMatch(m.name) === wanted);
    if (!targetChar) {
      const targetsPersona = wanted === normalizeTextForMatch(args.personaName) || wanted === "user";
      if (!targetsPersona) {
        logger.debug(
          '[react/conversation] Unknown react target "%s" - falling back to the user message',
          command.targetCharacter,
        );
      }
    } else {
      const resolved = await resolveTargetedCharacterReaction(command, args, chatMembers, targetChar, wanted);
      if (!resolved) return null;
      targetId = resolved.id;
      segmentTarget = resolved.target;
      prefetchedMessage = resolved.prefetchedMessage;
    }
  }

  return typeof targetId === "string" ? { id: targetId, segmentTarget, prefetchedMessage } : null;
}

async function resolveTargetedCharacterReaction(
  command: ReactCommand,
  args: Parameters<typeof handleConversationReactCommand>[0],
  chatMembers: ChatMember[],
  targetChar: ChatMember,
  wanted: string,
): Promise<{ id: string; target: SegmentTarget | null; prefetchedMessage: MessageRow | null } | null> {
  const baseNames = new Set(chatMembers.map((m) => normalizeTextForMatch(m.name)));
  const authorNameCache = new Map<string, string | null>();
  const authorNameOf = async (cid: unknown): Promise<string | null> => {
    if (typeof cid !== "string" || !cid) return null;
    const member = chatMembers.find((m) => m.id === cid);
    if (member) return member.name;
    if (authorNameCache.has(cid)) return authorNameCache.get(cid)!;
    let name: string | null = null;
    const row = await args.chars.getById(cid);
    if (row) {
      try {
        const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        const parsedName = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).name : null;
        if (typeof parsedName === "string" && parsedName.trim()) name = parsedName;
      } catch {
        // Malformed character data; segment matching can proceed without this author.
      }
    }
    authorNameCache.set(cid, name);
    return name;
  };

  const lastPartBy = async (
    content: unknown,
    authorId: unknown,
    beforePartByNorm?: string | null,
  ): Promise<SegmentTarget | null> => {
    const rawText = typeof content === "string" ? content : String(content ?? "");
    if (!rawText.trim() || rawText.length > REACTION_ANNOTATION_CONTENT_CAP) return null;
    const text = stripLeadingMessageTimestamps(rawText);
    if (!text) return null;
    const names = new Set(baseNames);
    const author = await authorNameOf(authorId);
    if (author) names.add(normalizeTextForMatch(author));
    const groups = parseGroupedSpeakerSegments(text, names, author);
    if (!groups) return null;
    let cutoff = groups.length;
    if (beforePartByNorm) {
      const reactorFirst = groups.findIndex(
        (group) => group.speaker != null && normalizeTextForMatch(group.speaker) === beforePartByNorm,
      );
      if (reactorFirst >= 0) cutoff = reactorFirst;
    }
    for (let gi = cutoff - 1; gi >= 0; gi--) {
      const group = groups[gi]!;
      if (
        group.speaker != null &&
        normalizeTextForMatch(group.speaker) === wanted &&
        group.lines.some((line) => line.trim().length > 0)
      ) {
        return { segment: gi, speaker: group.speaker };
      }
    }
    return null;
  };

  if (typeof args.sourceMessageId === "string") {
    const ownMsg = await args.chats.getMessage(args.sourceMessageId);
    if (ownMsg) {
      const reactorName = chatMembers.find((member) => member.id === args.characterId)?.name ?? null;
      const part = await lastPartBy(
        ownMsg.content,
        ownMsg.characterId,
        reactorName ? normalizeTextForMatch(reactorName) : null,
      );
      if (part) {
        return { id: args.sourceMessageId, target: part, prefetchedMessage: ownMsg };
      }
    }
  }

  const recent = [...args.chatMessages].slice(-30).reverse();
  for (const message of recent) {
    if (typeof message.id !== "string" || message.role === "user") continue;
    const messageExtra = parseExtra(message.extra) as Record<string, unknown>;
    if (messageExtra.hiddenFromUser === true || messageExtra.commandOnly === true) continue;
    const contentStr = typeof message.content === "string" ? message.content : String(message.content ?? "");
    const hasAttachments = Array.isArray(messageExtra.attachments) && messageExtra.attachments.length > 0;
    if (!contentStr.trim() && !hasAttachments) continue;
    if (message.characterId === targetChar.id) {
      return {
        id: message.id,
        target: await lastPartBy(message.content, message.characterId),
        prefetchedMessage: null,
      };
    }
    const part = await lastPartBy(message.content, message.characterId);
    if (part) {
      return { id: message.id, target: part, prefetchedMessage: null };
    }
  }

  logger.debug('[react/conversation] No recent part by "%s" to react to - skipping targeted react', targetChar.name);
  return null;
}

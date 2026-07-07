import type { ChatMode } from "@marinara-engine/shared";

import { stripConversationPromptTimestamps } from "../../services/conversation/transcript-sanitize.js";

type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  [key: string]: unknown;
};

type ConnectedConversationStore = {
  listPendingInfluences(chatId: string): Promise<Array<{ id: string; content?: unknown }>>;
  markInfluenceConsumed(id: string): Promise<unknown>;
  listNotes(chatId: string): Promise<Array<{ content?: unknown }>>;
  getById(chatId: string): Promise<{ mode?: string | null; name?: string | null } | null>;
};

function injectBeforeLastUser(messages: PromptMessage[], content: string): void {
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
  if (lastUserIdx >= 0) {
    messages.splice(lastUserIdx, 0, { role: "system", content });
  } else {
    messages.push({ role: "system", content });
  }
}

export async function injectConnectedConversationPromptBlocks(args: {
  chatMode: ChatMode;
  connectedChatId: unknown;
  isSceneChat: boolean;
  chatId: string;
  chats: ConnectedConversationStore;
  finalMessages: PromptMessage[];
}): Promise<void> {
  const { chatMode, connectedChatId, isSceneChat, chatId, chats, finalMessages } = args;
  if ((chatMode === "roleplay" || chatMode === "game") && connectedChatId && !isSceneChat) {
    const pendingInfluences = await chats.listPendingInfluences(chatId);
    if (pendingInfluences.length > 0) {
      const influenceLines = pendingInfluences
        .map((inf) => stripConversationPromptTimestamps(String(inf.content ?? "")))
        .filter((content) => content.length > 0)
        .map((content) => `- ${content}`);

      if (influenceLines.length > 0) {
        const influenceBlock = [
          `<ooc_influences>`,
          chatMode === "game"
            ? `The following out-of-character notes come from a connected conversation. They represent things the players discussed or decided outside the game. Use them to steer the next scene, NPC reactions, objectives, or world state when appropriate — don't mention them explicitly as "OOC" in the narrative.`
            : `The following out-of-character notes come from a connected conversation. They represent things the players discussed or decided outside of the roleplay. Weave them naturally into the story — don't mention them explicitly as "OOC" in the narrative.`,
          ...influenceLines,
          `</ooc_influences>`,
        ].join("\n");

        injectBeforeLastUser(finalMessages, influenceBlock);
      }

      for (const inf of pendingInfluences) {
        await chats.markInfluenceConsumed(inf.id);
      }
    }
  }

  if ((chatMode === "roleplay" || chatMode === "game") && connectedChatId && !isSceneChat) {
    const persistentNotes = await chats.listNotes(chatId);
    if (persistentNotes.length > 0) {
      const noteLines = persistentNotes
        .map((n) => stripConversationPromptTimestamps(String(n.content ?? "")))
        .filter((content) => content.length > 0)
        .map((content) => `- ${content}`);

      if (noteLines.length > 0) {
        const noteBlock = [
          `<conversation_notes>`,
          chatMode === "game"
            ? `Durable notes from a connected conversation. These persist across every turn until the user clears them and represent things the players have established as ongoing truth — character knowledge, world facts, recurring dynamics. Use them to inform NPC behavior, world state, and scene framing — don't reference them explicitly as "notes" in the narrative.`
            : `Durable notes from a connected conversation. These persist across every turn until the user clears them and represent things the character has been told to durably remember about themselves, the user, or the world. Use them to inform behavior, knowledge, and reactions naturally — don't reference them explicitly as "notes" in the narrative.`,
          ...noteLines,
          `</conversation_notes>`,
        ].join("\n");

        injectBeforeLastUser(finalMessages, noteBlock);
      }
    }
  }

  if (chatMode === "roleplay" && connectedChatId && !isSceneChat) {
    const convChat = await chats.getById(connectedChatId as string);
    if (convChat && convChat.mode === "conversation") {
      const oocInstruction = [
        `<ooc_instruction>`,
        `You have a connected out-of-character conversation: "${convChat.name}".`,
        `If a character wants to break the fourth wall and comment on something happening in the roleplay, post a reaction, or chat casually with the user "outside" the story, they can use an <ooc> tag:`,
        `<ooc>casual comment or reaction about what just happened in the RP</ooc>`,
        ``,
        `The <ooc> text is stripped from the roleplay response and posted as a message in the conversation chat.`,
        `Use this very sparingly — only when a character would genuinely want to comment out-of-character. Most RP responses should NOT include <ooc> tags.`,
        `</ooc_instruction>`,
      ].join("\n");

      const firstSysIdx = finalMessages.findIndex((m) => m.role === "system");
      if (firstSysIdx >= 0) {
        finalMessages.splice(firstSysIdx + 1, 0, { role: "system", content: oocInstruction });
      } else {
        finalMessages.unshift({ role: "system", content: oocInstruction });
      }
    }
  }
}

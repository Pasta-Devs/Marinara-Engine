import { getRoleplayDocuments, getRoleplayWhispers, type WrapFormat } from "@marinara-engine/shared";

import { isSentSelfieAttachment, type PromptAttachment } from "../../services/generation/prompt-attachments.js";
import { parseRoleplayUserCommands } from "../../services/generation/roleplay-commands.js";
import type { GenerationPromptMessage } from "../../services/generation/prompt-message-scope.js";
import { wrapContent } from "../../services/prompt/format-engine.js";
import { parseExtra } from "./generate-route-utils.js";

export const CONVERSATION_GROUP_NAME_PREFIX_INSTRUCTION = "Remember to prefix messages with `Name: message`!";
export const CONVERSATION_NO_REPEAT_INSTRUCTION =
  "Do not repeat a message you already sent in the recent conversation. If your first draft repeats one, write a genuinely different response.";

export function formatConversationGroupOutputFormat(args: {
  wrapFormat: WrapFormat;
  characterNames: string[];
  userName: string;
  turnCharacterName?: string | null;
}): string {
  const characterList = Array.from(new Set(args.characterNames.map((name) => name.trim()).filter(Boolean))).join(", ");
  const userName = args.userName.trim() || "the user";
  const responseBoundary = `Only respond for these characters: ${characterList || "the listed characters"}. Never respond for ${userName} or write ${userName}'s messages.`;
  const turnCharacterName = args.turnCharacterName?.trim();
  return wrapContent(
    turnCharacterName
      ? `Respond only as ${turnCharacterName}.`
      : [CONVERSATION_GROUP_NAME_PREFIX_INSTRUCTION, responseBoundary].join("\n"),
    "Output Format",
    args.wrapFormat,
  );
}

function presetStringField(preset: Record<string, unknown> | null | undefined, field: string): string {
  const value = preset?.[field];
  return typeof value === "string" ? value.trim() : "";
}

export function resolvePresetModePrompt(
  preset: Record<string, unknown> | null | undefined,
  mode: "conversation" | "game",
): string {
  return mode === "conversation"
    ? presetStringField(preset, "conversationPrompt")
    : presetStringField(preset, "gamePrompt");
}

export function formatConversationSummaryHistoryBlock(label: string, summary: string, wrapFormat: WrapFormat): string {
  if (wrapFormat === "xml") return `<summary ${label}>\n${summary}\n</summary>`;
  const displayLabel = label.replace(/="/g, ": ").replace(/"$/g, "");
  if (wrapFormat === "markdown") return `## Summary (${displayLabel})\n${summary}`;
  return `Summary (${displayLabel})\n${summary}`;
}

export function formatConversationDateHistoryMessages(
  messages: Array<{ role: "system" | "user" | "assistant"; author: string; content: string }>,
  date: string,
  wrapFormat: WrapFormat,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  if (messages.length === 0) return [];
  if (wrapFormat === "xml") {
    return messages.map((message, idx) => {
      let content = `${message.author}: ${message.content}`;
      if (idx === 0) content = `<date="${date}">\n${content}`;
      if (idx === messages.length - 1) content = `${content}\n</date>`;
      return { role: message.role, content };
    });
  }

  return messages.map((message, idx) => {
    const prefix = idx === 0 ? (wrapFormat === "markdown" ? `## Date: ${date}\n` : `Date: ${date}\n`) : "";
    return { role: message.role, content: `${prefix}${message.author}: ${message.content}` };
  });
}

export function appendToFirstSystemMessage(messages: GenerationPromptMessage[], content: string): void {
  const systemMessage = messages.find((message) => message.role === "system");
  if (systemMessage) {
    systemMessage.content = systemMessage.content ? `${systemMessage.content}\n\n${content}` : content;
    return;
  }
  messages.unshift({ role: "system", content });
}

export function latestHistoryUserContent(messages: GenerationPromptMessage[]): string {
  const historyTurn = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.contextKind === "history");
  if (historyTurn) return historyTurn.content;
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

export function conversationPromptHistoryContent(
  message: { role?: unknown; content?: unknown; extra?: unknown },
  chatMode: string,
): string {
  if (chatMode === "roleplay" && message.role === "user") {
    const content = parseRoleplayUserCommands(typeof message.content === "string" ? message.content : "").content;
    return content.trim() || !getRoleplayWhispers(parseExtra(message.extra)).length ? content : "[Private whisper]";
  }
  if (chatMode === "roleplay" && message.role === "assistant") {
    const extra = parseExtra(message.extra);
    const documents = getRoleplayDocuments(extra);
    const content = typeof message.content === "string" ? message.content : "";
    if (Array.isArray(documents))
      return [
        content.trim() || !getRoleplayWhispers(extra).length ? content : "[Private whisper]",
        ...documents
          .filter((document) => document && typeof document.title === "string" && typeof document.content === "string")
          .map((document) => `Document: ${document.title}\n${document.content}`),
      ].join("\n\n");
  }
  if (chatMode === "conversation" && message.role === "assistant") {
    const commandContent = parseExtra(message.extra).conversationCommandContent;
    if (typeof commandContent === "string" && commandContent.trim()) {
      return commandContent;
    }
  }
  return typeof message.content === "string" ? message.content : "";
}

const SENT_SELFIE_DESCRIPTION_MAX_CHARS = 600;

/**
 * History notes for video messages a character sent, so the next reply knows a clip went out and
 * what it shows. Only Conversation video messages name a sender; Roleplay scene clips stay hidden
 * like Illustrator images.
 */
export function formatSentVideoNotes(attachments: PromptAttachment[] | undefined): string {
  return (attachments ?? [])
    .filter((attachment) => attachment.type === "video" && !!attachment.characterName?.trim())
    .map((attachment) => {
      const description = (attachment.prompt ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, SENT_SELFIE_DESCRIPTION_MAX_CHARS);
      return `\n[${attachment.characterName!.trim()} sent a video message${description ? `: ${description}` : ""}]`;
    })
    .join("");
}

/**
 * History notes for selfies a character sent, so the next reply knows a photo went out and what it
 * shows. A saved caption describes the real image and wins, even after captioning is turned off;
 * otherwise the image prompt's first paragraph (later ones are appearance and reference notes).
 */
export function formatSentSelfieNotes(attachments: PromptAttachment[] | undefined): string {
  return (attachments ?? [])
    .filter(isSentSelfieAttachment)
    .map((attachment) => {
      const description = (attachment.imageCaption?.trim() || (attachment.prompt ?? "").split(/\n\s*\n/)[0]!)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, SENT_SELFIE_DESCRIPTION_MAX_CHARS);
      // Selfies saved before the sender was recorded have no name; their note stays unattributed.
      const sender = attachment.characterName?.trim();
      return `\n[${sender ? `${sender} sent` : "Sent"} a selfie${description ? `: ${description}` : ""}]`;
    })
    .join("");
}

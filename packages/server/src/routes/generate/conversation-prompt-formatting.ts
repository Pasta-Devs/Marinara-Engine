import type { WrapFormat } from "@marinara-engine/shared";

import type { GenerationPromptMessage } from "../../services/generation/prompt-message-scope.js";
import { wrapContent } from "../../services/prompt/format-engine.js";
import { parseExtra } from "./generate-route-utils.js";

export const CONVERSATION_GROUP_NAME_PREFIX_INSTRUCTION =
  "Remember to prefix messages with `Name: message`!";

export function formatConversationGroupOutputFormat(args: {
  wrapFormat: WrapFormat;
  characterNames: string[];
  userName: string;
}): string {
  const characterList = Array.from(new Set(args.characterNames.map((name) => name.trim()).filter(Boolean))).join(", ");
  const userName = args.userName.trim() || "the user";
  const responseBoundary = `Only respond for these characters: ${characterList || "the listed characters"}. Never respond for ${userName} or write ${userName}'s messages.`;
  return wrapContent(
    [CONVERSATION_GROUP_NAME_PREFIX_INSTRUCTION, responseBoundary].join("\n"),
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
  if (chatMode === "conversation" && message.role === "assistant") {
    const commandContent = parseExtra(message.extra).conversationCommandContent;
    if (typeof commandContent === "string" && commandContent.trim()) {
      return commandContent;
    }
  }
  return typeof message.content === "string" ? message.content : "";
}

import { stripMacroComments } from "@marinara-engine/shared";
import type { LLMUsage } from "../llm/base-provider.js";
import { stripGmCommandTags } from "../game/segment-edits.js";

export function cardPromptText(value: unknown): string {
  return typeof value === "string" ? stripMacroComments(value).trim() : "";
}

export function bumpCharacterVersion(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "1.1";
  const match = raw.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return `${raw}.1`;
  const prefix = match[1] ?? "";
  const numberPart = match[2] ?? "0";
  const suffix = match[3] ?? "";
  const next = String(Number(numberPart) + 1).padStart(numberPart.length, "0");
  return `${prefix}${next}${suffix}`;
}

const COMPLETE_OUTPUT_END_RE = /[.!?…。！？]["'”’)\]}»›]*$/;
const COMPLETE_SENTENCE_RE = /[.!?…。！？](?:["'”’)\]}»›]+)?(?=\s|$)/g;

export function trimIncompleteModelEnding(content: string): string {
  const trailingWhitespace = content.match(/\s*$/)?.[0] ?? "";
  const body = content.trimEnd();
  if (!body || COMPLETE_OUTPUT_END_RE.test(body)) return content;

  let lastCompleteEnd = -1;
  for (const match of body.matchAll(COMPLETE_SENTENCE_RE)) {
    lastCompleteEnd = (match.index ?? 0) + match[0].length;
  }
  if (lastCompleteEnd <= 0) return content;

  const tail = body.slice(lastCompleteEnd).trim();
  if (!tail) return content;

  const tailWithoutCommands = tail
    .replace(/\[[^\]]+\]/g, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .trim();
  if (!tailWithoutCommands) return content;

  return body.slice(0, lastCompleteEnd).trimEnd() + trailingWhitespace;
}

export function getHiddenCompletionTokens(usage: LLMUsage | undefined): number | undefined {
  if (!usage) return undefined;
  const hiddenParts = [
    usage.completionReasoningTokens,
    usage.completionAudioTokens,
    usage.rejectedPredictionTokens,
  ].filter((value): value is number => typeof value === "number");
  if (hiddenParts.length === 0) return undefined;
  return hiddenParts.reduce((sum, value) => sum + value, 0);
}

export function getVisibleCompletionTokens(usage: LLMUsage | undefined): number | undefined {
  if (!usage || typeof usage.completionTokens !== "number") return undefined;
  return Math.max(0, usage.completionTokens - (getHiddenCompletionTokens(usage) ?? 0));
}

export function sanitizeConnectedGameTranscript(content: string): string {
  return stripGmCommandTags(content)
    .replace(/^\[(?:To the party|To the GM)\]\s*/i, "")
    .trim();
}

export function stripSpacesBeforeLineBreaks(content: string): string {
  return content.replace(/[ \t]+(\r?\n)/g, "$1");
}

function prefixConversationUserTurn(content: string, personaName: string): string {
  const speaker = personaName.trim() || "User";
  const trimmed = content.trim();
  const escapedSpeaker = speaker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`^${escapedSpeaker}\\s*:`, "i").test(trimmed)) return trimmed;
  if (speaker === "User" && /^user\s*:/i.test(trimmed)) return trimmed;
  return trimmed ? `${speaker}: ${trimmed}` : `${speaker}:`;
}

export function formatConversationPromptTurn(content: string, role: string, personaName: string): string {
  return role === "user" ? prefixConversationUserTurn(content, personaName) : content.trim();
}

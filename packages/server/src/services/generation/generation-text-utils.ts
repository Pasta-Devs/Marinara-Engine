import type { LLMUsage } from "../llm/base-provider.js";
import { stripGmCommandTags } from "../game/segment-edits.js";

/** Preserve turn-wide billing counters across every completed request. */
export function addGenerationUsage(total: LLMUsage | undefined, next: LLMUsage | undefined): LLMUsage | undefined {
  if (!next) return total;
  if (!total) return { ...next };
  const merged = { ...total, ...next };
  for (const key of [
    "promptTokens",
    "completionTokens",
    "totalTokens",
    "cachedPromptTokens",
    "cacheWritePromptTokens",
    "completionReasoningTokens",
    "completionAudioTokens",
    "acceptedPredictionTokens",
    "rejectedPredictionTokens",
  ] as const) {
    if (total[key] != null || next[key] != null) merged[key] = (total[key] ?? 0) + (next[key] ?? 0);
  }
  return merged;
}

/** One request's occupied context, separate from the sum billed over a turn. */
export function getRequestContextTokens(usage: LLMUsage | undefined, provider: string): number | null {
  if (!usage) return null;
  const count = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
  const total = Math.max(count(usage.totalTokens), count(usage.promptTokens) + count(usage.completionTokens));
  // Claude's native APIs report uncached input separately; OpenAI-compatible and
  // Gemini prompt counts already include cached input. Gemini total also includes thinking.
  return (
    total +
    (provider === "anthropic" || provider === "claude_subscription"
      ? count(usage.cachedPromptTokens) + count(usage.cacheWritePromptTokens)
      : 0)
  );
}

/** Input size of one request; never substitute turn-wide billing totals for this value. */
export function getRequestInputTokens(usage: LLMUsage | undefined, provider: string): number | null {
  if (!usage || !Number.isFinite(usage.promptTokens) || usage.promptTokens < 0) return null;
  const count = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
  return (
    usage.promptTokens +
    (provider === "anthropic" || provider === "claude_subscription"
      ? count(usage.cachedPromptTokens) + count(usage.cacheWritePromptTokens)
      : 0)
  );
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

const COMPLETE_OUTPUT_END_RE = /[.!?…。！？]["'”’)\]}»›*_~`]*$/;
const COMPLETE_SENTENCE_RE = /[.!?…。！？](?:["'”’)\]}»›*_~`]+)?(?=\s|$)/g;

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

function prefixConversationSpeakerTurn(content: string, speakerName: string, fallbackSpeaker: string): string {
  const speaker = speakerName.trim() || fallbackSpeaker;
  const trimmed = content.trim();
  const escapedSpeaker = speaker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`^${escapedSpeaker}\\s*:`, "i").test(trimmed)) return trimmed;
  if (speaker === "User" && /^user\s*:/i.test(trimmed)) return trimmed;
  return trimmed ? `${speaker}: ${trimmed}` : `${speaker}:`;
}

export function formatConversationPromptTurn(
  content: string,
  role: string,
  personaName: string,
  assistantName?: string | null,
): string {
  if (role === "user") return prefixConversationSpeakerTurn(content, personaName, "User");
  if (role === "assistant" && assistantName?.trim()) {
    return prefixConversationSpeakerTurn(content, assistantName, "Character");
  }
  return content.trim();
}

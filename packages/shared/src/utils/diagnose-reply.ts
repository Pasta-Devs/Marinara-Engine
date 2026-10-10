import type { CharacterData } from "../types/character.js";
import type { GenerationInfo } from "../types/chat.js";
import { estimateCharacterCardTokens } from "./character-token-estimator.js";
import { describeEmptyModelResponse } from "./empty-response-reason.js";

/**
 * Reply checkup (slice 61, R2): why a reply may have gone wrong, read from the facts the server
 * already saved on the message. Deterministic, no model call. The chat's quiet line, the omnibar
 * Fix row, the Peek header and Professor Mari's `chat.diagnose` read all show this one result.
 */
export type ReplyCheckupCode =
  "cut_off" | "empty_reply" | "history_trimmed" | "reply_budget_cut" | "lore_budget_skipped" | "card_large";

/** The setting that addresses a finding: a Chat Settings section (its `initialSection`) or an editor. */
export type ReplyCheckupLink =
  | { kind: "chat-settings"; section: "advanced-parameters" | "lorebooks" }
  | { kind: "resource"; resource: "connection" | "lorebook" | "character"; id: string };

export interface ReplyCheckupFinding {
  code: ReplyCheckupCode;
  /** One English line with the numbers, for logs and Professor Mari. The UI localizes `code` + `values`. */
  text: string;
  /** The numbers and names `text` quotes. */
  values: Record<string, string | number>;
  link: ReplyCheckupLink | null;
}

/** A card that takes more than this share of the prompt budget crowds out history and lore. */
export const CARD_LARGE_CONTEXT_SHARE = 0.4;

/**
 * Findings about the reply itself. Only these earn a quiet line under the reply and the omnibar Fix
 * row; lore skips and a large card describe the chat's setup and show inside the checkup.
 */
export const REPLY_CHECKUP_LINE_CODES: readonly ReplyCheckupCode[] = [
  "cut_off",
  "empty_reply",
  "history_trimmed",
  "reply_budget_cut",
];

type BudgetSkippedEntry = {
  name?: string;
  lorebookId?: string;
  blockedBy?: "lorebook" | "chat" | "both" | "location";
};

export interface ReplyCheckupInput {
  message: {
    content: string;
    extra?: {
      generationInfo?: (Partial<GenerationInfo> & { maxTokens?: number | null; maxContext?: number | null }) | null;
      /** The lorebook scan snapshot the generate route saves with each reply. */
      lorebookScan?: { budgetSkippedEntries?: BudgetSkippedEntry[] } | null;
      thinking?: string | null;
      commandOnly?: boolean;
    } | null;
  };
  /** The chat's connection, where Max Context Window is set. */
  connectionId?: string | null;
  /** The character who wrote the reply. */
  character?: { id: string; data: Partial<CharacterData> } | null;
}

const positive = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

export function diagnoseReply({ message, connectionId, character }: ReplyCheckupInput): ReplyCheckupFinding[] {
  const extra = message.extra ?? {};
  const info = extra.generationInfo ?? null;
  const fit = info?.contextFit ?? null;
  const findings: ReplyCheckupFinding[] = [];
  const advancedParameters: ReplyCheckupLink = { kind: "chat-settings", section: "advanced-parameters" };

  const empty = !message.content.trim() && !extra.commandOnly;
  if (empty && info) {
    findings.push({
      code: "empty_reply",
      text: describeEmptyModelResponse({
        finishReason: info.finishReason,
        usage:
          typeof info.tokensCompletion === "number"
            ? { completionTokens: info.tokensCompletion, completionReasoningTokens: info.tokensReasoning ?? undefined }
            : null,
        maxTokens: info.maxTokens,
        hadThinking: Boolean(extra.thinking?.trim()),
      }),
      values: info.finishReason ? { reason: info.finishReason } : {},
      link: advancedParameters,
    });
  } else if (info?.finishReason === "length") {
    const limit = positive(fit?.replyBudgetTo) ?? positive(info.maxTokens);
    findings.push({
      code: "cut_off",
      text: limit
        ? `The reply hit its ${limit}-token output limit and stopped mid-sentence.`
        : "The reply hit its output limit and stopped mid-sentence.",
      values: limit ? { limit } : {},
      link: advancedParameters,
    });
  }

  if (fit?.trimmed && fit.droppedHistory > 0) {
    findings.push({
      code: "history_trimmed",
      text: `${fit.droppedHistory} older messages were not sent: the prompt needed ${fit.tokensBefore} tokens, the budget was ${fit.inputBudget}.`,
      values: { count: fit.droppedHistory, before: fit.tokensBefore, budget: fit.inputBudget },
      link: connectionId ? { kind: "resource", resource: "connection", id: connectionId } : null,
    });
  }

  if (fit && fit.replyBudgetFrom > 0 && fit.replyBudgetTo < fit.replyBudgetFrom) {
    findings.push({
      code: "reply_budget_cut",
      text: `The reply limit was cut from ${fit.replyBudgetFrom} to ${fit.replyBudgetTo} tokens to make room for the prompt.`,
      values: { from: fit.replyBudgetFrom, to: fit.replyBudgetTo },
      link: advancedParameters,
    });
  }

  // "location" skips are entries for another place, not a budget problem.
  const skipped = (extra.lorebookScan?.budgetSkippedEntries ?? []).filter((entry) => entry.blockedBy !== "location");
  if (skipped.length > 0) {
    const names = skipped
      .slice(0, 3)
      .map((entry) => entry.name || "?")
      .join(", ");
    const chatBudget = skipped.some((entry) => entry.blockedBy === "chat" || entry.blockedBy === "both");
    const lorebookId = skipped.find((entry) => entry.lorebookId)?.lorebookId;
    findings.push({
      code: "lore_budget_skipped",
      text: `${skipped.length} lorebook entries matched but were left out by the token budget: ${names}.`,
      values: { count: skipped.length, names },
      link: chatBudget
        ? { kind: "chat-settings", section: "lorebooks" }
        : lorebookId
          ? { kind: "resource", resource: "lorebook", id: lorebookId }
          : null,
    });
  }

  const budget = positive(fit?.inputBudget) ?? positive(info?.maxContext);
  if (character && budget) {
    // Only the fields that go into every prompt: greetings, creator notes and the embedded book do not.
    const tokens = estimateCharacterCardTokens({
      ...character.data,
      first_mes: "",
      alternate_greetings: [],
      creator_notes: "",
      character_book: null,
    });
    const share = tokens / budget;
    if (share > CARD_LARGE_CONTEXT_SHARE) {
      const percent = Math.round(share * 100);
      const cardLarge: ReplyCheckupFinding = {
        code: "card_large",
        text: `The character card is about ${tokens} tokens, ${percent}% of the ${budget}-token prompt budget.`,
        values: { tokens, percent, budget },
        link: { kind: "resource", resource: "character", id: character.id },
      };
      // F4: when the card crowds out the budget enough to trim history or cut the reply limit, the
      // trim is the card's symptom, not an independent cause — lead with the card so "name one cause"
      // (the Fix row, the panel order, chat.diagnose) points at the real fix, not the visible effect.
      const causesTrim = findings.some((f) => f.code === "history_trimmed" || f.code === "reply_budget_cut");
      if (causesTrim) findings.unshift(cardLarge);
      else findings.push(cardLarge);
    }
  }

  return findings;
}

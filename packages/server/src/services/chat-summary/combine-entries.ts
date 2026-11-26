// ──────────────────────────────────────────────
// Combine summary entries: one model call condenses several Chat Summary entries into one entry that takes
// their place (keeping their order and the messages they cover). Used by the summary list's Combine button
// and by "Combine older summaries automatically".
// ──────────────────────────────────────────────
import {
  combineChatSummaryEntryHistory,
  compileChatSummaryEntries,
  createChatSummaryEntry,
  estimateChatSummaryTokens,
  normalizeChatSummaryEntries,
  type ChatSummaryEntry,
} from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { newId } from "../../utils/id-generator.js";
import {
  parseChatSummaryResult,
  resolveChatSummaryCombinePrompt,
  resolveChatSummaryPrompt,
} from "../generation/roleplay-summary-runtime.js";

const SUMMARY_COMBINE_DEFAULT_CONTEXT_TOKENS = 32_768;
const SUMMARY_COMBINE_MESSAGE_OVERHEAD_TOKENS = 64;

export const SUMMARY_AUTO_COMBINE = { MIN: 2, MAX: 100, SUGGESTED: 10 } as const;

/** Chat setting `summaryAutoCombineAbove`: combine when there are more entries than this; 0 means off. */
export function normalizeSummaryAutoCombineAbove(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < SUMMARY_AUTO_COMBINE.MIN) return 0;
  return Math.min(SUMMARY_AUTO_COMBINE.MAX, parsed);
}

/**
 * The entries automatic combining folds together, or none while the count is within the limit: every turned-on
 * entry except the newest, so the next combine is a whole limit's worth of summaries away. It runs right after a
 * new summary is saved, the moment the Past Events block changes anyway, so it costs no extra prompt-cache write.
 */
export function selectEntriesToAutoCombine(entries: readonly ChatSummaryEntry[], above: number): string[] {
  if (above < SUMMARY_AUTO_COMBINE.MIN) return [];
  const enabled = entries.filter((entry) => entry.enabled);
  if (enabled.length <= above) return [];
  return enabled
    .slice(0, -1)
    .slice(-SUMMARY_AUTO_COMBINE.MAX)
    .map((entry) => entry.id);
}

export type CombineSummaryEntriesResult =
  | { ok: true; entry: ChatSummaryEntry; entries: ChatSummaryEntry[]; summary: string | null }
  | { ok: false; status: 400 | 404 | 500; error: string };

export async function combineSummaryEntries(args: {
  chatId: string;
  chatMeta: Record<string, unknown>;
  entryIds: readonly string[];
  provider: BaseLLMProvider;
  model: string;
  temperatureOptions: Record<string, unknown>;
  summaryMaxTokens: number;
  promptTemplateId: string | null;
  globalSummaryPromptSettings: string | null;
  storage: {
    patchMetadata(
      id: string,
      patch: (meta: Record<string, unknown>) => Record<string, unknown>,
    ): Promise<unknown | null | undefined>;
  };
  signal?: AbortSignal;
  /** Throws when the caller's request was cancelled. */
  throwIfAborted?: () => void;
}): Promise<CombineSummaryEntriesResult> {
  const checkAborted = args.throwIfAborted ?? (() => undefined);
  const requestedIds = new Set(args.entryIds);
  const currentEntries = normalizeChatSummaryEntries(args.chatMeta.summaryEntries, {
    legacySummary: typeof args.chatMeta.summary === "string" ? args.chatMeta.summary : null,
  });
  const selectedEntries = currentEntries.filter((entry) => requestedIds.has(entry.id));
  if (selectedEntries.length !== requestedIds.size) {
    return { ok: false, status: 400, error: "One or more selected summary entries no longer exist" };
  }
  const effectiveSummaryMaxTokens = Math.min(
    args.summaryMaxTokens,
    args.provider.maxTokensOverrideValue ?? args.summaryMaxTokens,
  );
  const summaryPrompt = resolveChatSummaryPrompt({
    requestedTemplateId: args.promptTemplateId,
    chatMetadata: args.chatMeta,
    globalSettingsValue: args.globalSummaryPromptSettings,
  });
  const combinePrompt = resolveChatSummaryCombinePrompt(args.globalSummaryPromptSettings);
  const sourceText = selectedEntries
    .map((entry, index) => `Summary ${index + 1} — ${entry.title}:\n${entry.content}`)
    .join("\n\n");
  const inputBudget = Math.max(
    0,
    (args.provider.maxContextValue ?? SUMMARY_COMBINE_DEFAULT_CONTEXT_TOKENS) -
      effectiveSummaryMaxTokens -
      estimateChatSummaryTokens(summaryPrompt) -
      estimateChatSummaryTokens(combinePrompt) -
      SUMMARY_COMBINE_MESSAGE_OVERHEAD_TOKENS,
  );
  if (estimateChatSummaryTokens(sourceText) > inputBudget) {
    return { ok: false, status: 400, error: "Selected summaries are too large to combine at once" };
  }
  checkAborted();
  const result = await args.provider.chatComplete(
    [
      { role: "system", content: summaryPrompt },
      { role: "user", content: `${combinePrompt}\n\n${sourceText}` },
    ],
    {
      model: args.model,
      ...args.temperatureOptions,
      maxTokens: effectiveSummaryMaxTokens,
      signal: args.signal,
    },
  );
  checkAborted();
  if (!result.content) return { ok: false, status: 500, error: "No response from AI" };
  const parsedSummary = parseChatSummaryResult(result.content);
  const summaryText = parsedSummary.summary;
  if (!summaryText) return { ok: false, status: 500, error: "No summary returned by AI" };

  let combinedEntry: ChatSummaryEntry | null = null;
  let combinedEntries: ChatSummaryEntry[] = [];
  let combinedSummary: string | null = null;
  const updated = await args.storage.patchMetadata(args.chatId, (freshMeta) => {
    checkAborted();
    const entries = normalizeChatSummaryEntries(freshMeta.summaryEntries, {
      legacySummary: typeof freshMeta.summary === "string" ? freshMeta.summary : null,
    });
    const selected = entries.filter((entry) => requestedIds.has(entry.id));
    if (selected.length !== requestedIds.size) {
      throw new Error("One or more selected summary entries changed while they were being combined");
    }
    const messageIds = Array.from(new Set(selected.flatMap((entry) => entry.messageIds ?? [])));
    const hiddenMessageIds = Array.from(new Set(selected.flatMap((entry) => entry.hiddenMessageIds ?? [])));
    const starts = selected.flatMap((entry) => entry.rangeStartIndex ?? []);
    const ends = selected.flatMap((entry) => entry.rangeEndIndex ?? []);
    const now = new Date().toISOString();
    combinedEntry = createChatSummaryEntry(
      {
        kind: "rolling",
        origin: "manual",
        title: parsedSummary.title || "Combined summary",
        content: summaryText,
        enabled: selected.some((entry) => entry.enabled),
        sourceMode: starts.length > 0 || ends.length > 0 ? "range" : "last",
        messageCount:
          messageIds.length > 0
            ? messageIds.length
            : selected.reduce((total, entry) => total + (entry.messageCount ?? 0), 0) || undefined,
        rangeStartIndex: starts.length > 0 ? Math.min(...starts) : undefined,
        rangeEndIndex: ends.length > 0 ? Math.max(...ends) : undefined,
        messageIds,
        hiddenMessageIds,
        promptTemplateId: args.promptTemplateId,
        createdAt: selected[0]?.createdAt ?? now,
        updatedAt: now,
      },
      { createId: newId, now },
    );
    combinedEntries = combineChatSummaryEntryHistory(entries, requestedIds, combinedEntry, now);
    combinedSummary = compileChatSummaryEntries(combinedEntries);
    return { summary: combinedSummary, summaryEntries: combinedEntries };
  });
  const entry = combinedEntry as ChatSummaryEntry | null;
  if (!updated || !entry) return { ok: false, status: 404, error: "Chat not found" };
  return { ok: true, entry, entries: combinedEntries, summary: combinedSummary };
}

import { compileChatSummaryEntries, normalizeChatSummaryEntries, type ChatSummaryEntry } from "@marinara-engine/shared";

import { logger } from "../../lib/logger.js";
import { calibrateLorebookSimilarity, cosineSimilarity, lorebookSimilarityBaseline } from "../lorebook/embeddings.js";
import { embedMemoryRecallTexts, type MemoryRecallEmbeddingOptions } from "../memory-recall.js";
import { normalizeSemanticSummaryRetrievalSettings } from "@marinara-engine/shared";
import { embedSummaryDocuments } from "./summary-document-embeddings.js";
const SEMANTIC_SUMMARY_CALIBRATION_TEXTS = [
  "A recipe explains how to bake a loaf of bread.",
  "A spacecraft studies distant galaxies and nebulae.",
  "A city council reviews municipal zoning regulations.",
] as const;

type RoleplaySummaryQueryMessage = {
  role?: string | null;
  content?: unknown;
};

/** The agent context toggle does not change main generation or dedicated summary requests. */
export function shouldAttachSummariesToAgents(chatMode: string, chatMetadata: Record<string, unknown>): boolean {
  return chatMode !== "roleplay" || chatMetadata.attachSummariesToAgents === true;
}

function filterExcludedSummaryEntries(entries: ChatSummaryEntry[], excludeMessageIds: readonly string[]) {
  const excludedMessageIds = new Set(excludeMessageIds.filter(Boolean));
  if (excludedMessageIds.size === 0) return entries;
  return entries.filter((entry) => {
    const coveredMessageIds = [...(entry.messageIds ?? []), ...(entry.hiddenMessageIds ?? [])];
    return !coveredMessageIds.some((messageId) => excludedMessageIds.has(messageId));
  });
}

/** Ids of the newest `count` entries by creation time, which semantic retrieval always keeps. */
function newestSummaryEntryIds(entries: readonly ChatSummaryEntry[], count: number): Set<string> {
  return new Set(
    [...entries]
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
      .slice(Math.max(0, entries.length - count))
      .map((entry) => entry.id),
  );
}

/**
 * The enabled entries every Roleplay prompt keeps. An excluded message, such as the reply a swipe replaces,
 * leaves out each entry that covers it, and semantic retrieval can leave out any entry but its newest ones.
 */
export function summaryEntriesAlwaysInPrompt(
  chatMetadata: Record<string, unknown>,
  excludeMessageIds: readonly string[] = [],
): ChatSummaryEntry[] {
  const enabled = filterExcludedSummaryEntries(
    normalizeChatSummaryEntries(chatMetadata.summaryEntries),
    excludeMessageIds,
  ).filter((entry) => entry.enabled);
  if (chatMetadata.semanticSummaryRetrievalEnabled !== true) return enabled;
  const { semanticSummaryRecentCount } = normalizeSemanticSummaryRetrievalSettings(chatMetadata);
  const newest = newestSummaryEntryIds(enabled, semanticSummaryRecentCount);
  return enabled.filter((entry) => newest.has(entry.id));
}

function buildRoleplaySummaryRetrievalQuery(messages: readonly RoleplaySummaryQueryMessage[]): string {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-4)
    .map((message) => (typeof message.content === "string" ? message.content.trim() : ""))
    .filter(Boolean)
    .join("\n");
}

export function resolveRoleplayChatSummary(
  chatMode: string,
  chatMetadata: Record<string, unknown>,
  options: { excludeMessageIds?: readonly string[] } = {},
): string | null {
  if (chatMode !== "roleplay") return null;
  const summary = ((chatMetadata.summary as string) ?? "").trim() || null;
  const excludedMessageIds = options.excludeMessageIds ?? [];
  if (excludedMessageIds.length === 0) return summary;

  const entries = normalizeChatSummaryEntries(chatMetadata.summaryEntries);
  // Legacy summaries have no per-message provenance, so they cannot be
  // safely retained while regenerating a historical message.
  if (entries.length === 0) return null;
  const retainedEntries = filterExcludedSummaryEntries(entries, excludedMessageIds);
  return retainedEntries.length === entries.length ? summary : compileChatSummaryEntries(retainedEntries);
}

/** Keep recent Roleplay summaries active while recalling only relevant older entries. */
export async function resolveRoleplayChatSummaryForPrompt(args: {
  chatMode: string;
  chatMetadata: Record<string, unknown>;
  messages: readonly RoleplaySummaryQueryMessage[];
  excludeMessageIds?: readonly string[];
  vectorizerAvailable: boolean;
  embeddingOptions?: MemoryRecallEmbeddingOptions;
}): Promise<string | null> {
  const fallbackSummary = resolveRoleplayChatSummary(args.chatMode, args.chatMetadata, {
    excludeMessageIds: args.excludeMessageIds,
  });
  if (!fallbackSummary || args.chatMetadata.semanticSummaryRetrievalEnabled !== true || !args.vectorizerAvailable) {
    return fallbackSummary;
  }

  const query = buildRoleplaySummaryRetrievalQuery(args.messages);
  if (!query) return fallbackSummary;

  const entries = filterExcludedSummaryEntries(
    normalizeChatSummaryEntries(args.chatMetadata.summaryEntries),
    args.excludeMessageIds ?? [],
  );
  const enabledEntries = entries.filter((entry) => entry.enabled);
  const settings = normalizeSemanticSummaryRetrievalSettings(args.chatMetadata);
  if (enabledEntries.length <= settings.semanticSummaryRecentCount) return fallbackSummary;

  const newestEntryIds = newestSummaryEntryIds(enabledEntries, settings.semanticSummaryRecentCount);
  if (settings.semanticSummaryOlderCount === 0) {
    return compileChatSummaryEntries(enabledEntries.filter((entry) => newestEntryIds.has(entry.id)));
  }
  const olderEntries = enabledEntries.filter((entry) => !newestEntryIds.has(entry.id));

  try {
    const [queryEmbeddings, summaryEmbeddings] = await Promise.all([
      embedMemoryRecallTexts([query, ...SEMANTIC_SUMMARY_CALIBRATION_TEXTS], {
        ...(args.embeddingOptions ?? {}),
        inputType: "query",
      }),
      embedSummaryDocuments(
        olderEntries.map((entry) => entry.content),
        args.embeddingOptions ?? {},
      ),
    ]);
    const queryEmbedding = queryEmbeddings[0];
    if (!queryEmbedding?.length || summaryEmbeddings.length !== olderEntries.length) return fallbackSummary;
    if (summaryEmbeddings.some((embedding) => embedding.length !== queryEmbedding.length)) {
      const refreshed = await embedSummaryDocuments(
        olderEntries.map((entry) => entry.content),
        args.embeddingOptions ?? {},
        queryEmbedding.length,
      );
      if (refreshed.length !== olderEntries.length) return fallbackSummary;
      summaryEmbeddings.splice(0, summaryEmbeddings.length, ...refreshed);
    }

    const baseline = lorebookSimilarityBaseline(queryEmbeddings.slice(1));
    const relevantOlderIds = new Set(
      olderEntries
        .map((entry, index) => {
          const embedding = summaryEmbeddings[index];
          if (!embedding || embedding.length !== queryEmbedding.length) return null;
          return {
            id: entry.id,
            similarity: calibrateLorebookSimilarity(cosineSimilarity(queryEmbedding, embedding), baseline),
          };
        })
        .filter((match): match is { id: string; similarity: number } => match !== null)
        .filter((match) => match.similarity >= settings.semanticSummaryMinSimilarity)
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, settings.semanticSummaryOlderCount)
        .map((match) => match.id),
    );

    return compileChatSummaryEntries(
      enabledEntries.filter((entry) => newestEntryIds.has(entry.id) || relevantOlderIds.has(entry.id)),
    );
  } catch (error) {
    logger.warn(error, "[roleplay-summary] Semantic retrieval failed; keeping all summaries in context");
    return fallbackSummary;
  }
}

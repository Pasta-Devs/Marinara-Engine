import { compileChatSummaryEntries, normalizeChatSummaryEntries, type ChatSummaryEntry } from "@marinara-engine/shared";

import { logger } from "../../lib/logger.js";
import { calibrateLorebookSimilarity, cosineSimilarity, lorebookSimilarityBaseline } from "../lorebook/embeddings.js";
import { embedMemoryRecallTexts, type MemoryRecallEmbeddingOptions } from "../memory-recall.js";

const SEMANTIC_SUMMARY_RECENT_ENTRY_COUNT = 2;
const SEMANTIC_SUMMARY_TOP_K = 3;
const SEMANTIC_SUMMARY_MIN_SIMILARITY = 0.15;
const SEMANTIC_SUMMARY_CALIBRATION_TEXTS = [
  "A recipe explains how to bake a loaf of bread.",
  "A spacecraft studies distant galaxies and nebulae.",
  "A city council reviews municipal zoning regulations.",
] as const;

type RoleplaySummaryQueryMessage = {
  role?: string | null;
  content?: unknown;
};

function filterExcludedSummaryEntries(entries: ChatSummaryEntry[], excludeMessageIds: readonly string[]) {
  const excludedMessageIds = new Set(excludeMessageIds.filter(Boolean));
  if (excludedMessageIds.size === 0) return entries;
  return entries.filter((entry) => {
    const coveredMessageIds = [...(entry.messageIds ?? []), ...(entry.hiddenMessageIds ?? [])];
    return !coveredMessageIds.some((messageId) => excludedMessageIds.has(messageId));
  });
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

/** Keep manual and recent Roleplay summaries active while recalling only relevant older automatic entries. */
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
  const automatedEntries = entries.filter((entry) => entry.enabled && entry.origin === "automated");
  if (automatedEntries.length <= SEMANTIC_SUMMARY_RECENT_ENTRY_COUNT) return fallbackSummary;

  const newestAutomatedIds = new Set(
    [...automatedEntries]
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
      .slice(-SEMANTIC_SUMMARY_RECENT_ENTRY_COUNT)
      .map((entry) => entry.id),
  );
  const olderEntries = automatedEntries.filter((entry) => !newestAutomatedIds.has(entry.id));

  try {
    const [queryEmbeddings, summaryEmbeddings] = await Promise.all([
      embedMemoryRecallTexts([query, ...SEMANTIC_SUMMARY_CALIBRATION_TEXTS], {
        ...(args.embeddingOptions ?? {}),
        inputType: "query",
      }),
      embedMemoryRecallTexts(
        olderEntries.map((entry) => entry.content),
        { ...(args.embeddingOptions ?? {}), inputType: "document" },
      ),
    ]);
    const queryEmbedding = queryEmbeddings[0];
    if (!queryEmbedding?.length || summaryEmbeddings.length !== olderEntries.length) return fallbackSummary;

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
        .filter((match) => match.similarity >= SEMANTIC_SUMMARY_MIN_SIMILARITY)
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, SEMANTIC_SUMMARY_TOP_K)
        .map((match) => match.id),
    );

    return compileChatSummaryEntries(
      entries.filter(
        (entry) => entry.origin !== "automated" || newestAutomatedIds.has(entry.id) || relevantOlderIds.has(entry.id),
      ),
    );
  } catch (error) {
    logger.warn(error, "[roleplay-summary] Semantic retrieval failed; keeping all summaries in context");
    return fallbackSummary;
  }
}

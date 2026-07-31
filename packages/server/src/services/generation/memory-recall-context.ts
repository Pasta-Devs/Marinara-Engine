import type { WrapFormat } from "@marinara-engine/shared";

import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { recallMemories } from "../memory-recall.js";
import type { MemoryRecallEmbeddingSource } from "../memory-recall.js";
import { wrapContent } from "../prompt/format-engine.js";
import { sanitizePromptLeaf } from "../prompt/prompt-escaping.js";
import { packRecalledMemories } from "./memory-recall-pack.js";

type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function buildMemoryRecallBlock(
  lines: string[],
  wrapFormat: WrapFormat,
  resolveMacros?: (value: string) => string,
): string {
  const content = [
    `The following are recalled fragments from earlier in this conversation. Use them to maintain continuity, remember past events, and stay in character — but do not explicitly reference "remembering" unless it's natural.`,
    ...lines.map((line, index) => {
      const resolved = resolveMacros ? resolveMacros(line) : line;
      return `--- Memory ${index + 1} ---\n${sanitizePromptLeaf(resolved, wrapFormat)}`;
    }),
  ].join("\n");
  return wrapContent(content, "Memories", wrapFormat);
}

export async function injectMemoryRecallContext({
  db,
  messages,
  currentInputMessages,
  chatId,
  embeddingSource,
  excludeFromMessageAt,
  contextLimit,
  sendProgress,
  signal,
  resolveMacros,
  wrapFormat,
}: {
  db: DB;
  messages: PromptMessage[];
  currentInputMessages: PromptMessage[];
  chatId: string;
  embeddingSource: MemoryRecallEmbeddingSource | null;
  excludeFromMessageAt?: string | null;
  contextLimit: number | undefined;
  sendProgress(phase: string): void;
  signal?: AbortSignal;
  resolveMacros?: (value: string) => string;
  wrapFormat: WrapFormat;
}): Promise<string[]> {
  sendProgress("memory_recall");
  const startedAt = Date.now();
  try {
    const lastUserMsg = [...currentInputMessages].reverse().find((message) => message.role === "user");
    if (!lastUserMsg?.content?.trim()) return [];

    const recalled = await recallMemories(db, lastUserMsg.content, [chatId], {
      embeddingSource,
      excludeFromMessageAt,
      signal,
    });
    if (recalled.length === 0) return [];

    const packedRecall = packRecalledMemories(recalled, contextLimit);
    if (packedRecall.lines.length === 0) {
      logger.debug("[memory-recall] Skipped recalled memories after budgeting (%d candidates)", recalled.length);
      return [];
    }

    const resolvedLines = resolveMacros ? packedRecall.lines.map((line) => resolveMacros(line)) : packedRecall.lines;
    const memoriesBlock = buildMemoryRecallBlock(resolvedLines, wrapFormat);

    logger.debug(
      "[memory-recall] Injecting %d/%d recalled memories (~%d/%d tokens)%s",
      packedRecall.lines.length,
      recalled.length,
      packedRecall.estimatedTokens,
      packedRecall.budgetTokens,
      packedRecall.trimmed ? " after trimming" : "",
    );

    const firstUserIdx = messages.findIndex((message) => message.role === "user" || message.role === "assistant");
    const insertAt = firstUserIdx >= 0 ? firstUserIdx : messages.length;
    messages.splice(insertAt, 0, { role: "system", content: memoriesBlock });
    return resolvedLines;
  } catch (err) {
    logger.error(err, "[memory-recall] Recall failed, skipping");
    return [];
  } finally {
    logger.debug(`[timing] Memory recall: ${Date.now() - startedAt}ms`);
  }
}

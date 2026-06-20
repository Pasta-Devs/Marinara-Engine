import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { recallMemories } from "../memory-recall.js";
import type { MemoryRecallEmbeddingSource } from "../memory-recall.js";
import { packRecalledMemories } from "./memory-recall-pack.js";

type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function injectMemoryRecallContext({
  db,
  messages,
  currentInputMessages,
  chatId,
  embeddingSource,
  contextLimit,
  sendProgress,
}: {
  db: DB;
  messages: PromptMessage[];
  currentInputMessages: PromptMessage[];
  chatId: string;
  embeddingSource: MemoryRecallEmbeddingSource | null;
  contextLimit: number | undefined;
  sendProgress(phase: string): void;
}): Promise<void> {
  sendProgress("memory_recall");
  const startedAt = Date.now();
  try {
    const lastUserMsg = [...currentInputMessages].reverse().find((message) => message.role === "user");
    if (!lastUserMsg?.content?.trim()) return;

    const recalled = await recallMemories(db, lastUserMsg.content, [chatId], { embeddingSource });
    if (recalled.length === 0) return;

    const packedRecall = packRecalledMemories(recalled, contextLimit);
    if (packedRecall.lines.length === 0) {
      logger.debug("[memory-recall] Skipped recalled memories after budgeting (%d candidates)", recalled.length);
      return;
    }

    const memoriesBlock = [
      `<memories>`,
      `The following are recalled fragments from earlier in this conversation. Use them to maintain continuity, remember past events, and stay in character — but do not explicitly reference "remembering" unless it's natural.`,
      ...packedRecall.lines.map((line, index) => `--- Memory ${index + 1} ---\n${line}`),
      `</memories>`,
    ].join("\n");

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
  } catch (err) {
    logger.error(err, "[memory-recall] Recall failed, skipping");
  } finally {
    logger.debug(`[timing] Memory recall: ${Date.now() - startedAt}ms`);
  }
}

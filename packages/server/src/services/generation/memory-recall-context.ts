import { sliceTextToTokenBudget, type WrapFormat } from "@marinara-engine/shared";

import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { chunkCoversSentMessage, recallMemories } from "../memory-recall.js";
import type { MemoryRecallEmbeddingSource, RecalledMemory } from "../memory-recall.js";
import { wrapContent } from "../prompt/format-engine.js";
import { fillMemoryRecallSlot } from "../prompt/memory-recall-slot.js";
import { sanitizePromptLeaf } from "../prompt/prompt-escaping.js";
import { memoryRecallBudgetTokens, packRecalledMemories } from "./memory-recall-pack.js";

type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** A prompt message as generation holds it: chat history is marked `contextKind: "history"` and carries its id. */
export type MemoryRecallWindowMessage = PromptMessage & {
  id?: string | null;
  contextKind?: "prompt" | "history" | "injection";
};

/**
 * What recall needs to leave out the messages the request already sends. Without it, recall searches the whole chat.
 */
export interface MemoryRecallPromptWindow<T extends MemoryRecallWindowMessage> {
  /** The prompt so far. When memories are added, the oldest history they make room for is removed from it. */
  prompt: T[];
  /** When each chat message was created, by message id. */
  messageCreatedAt: ReadonlyMap<string, string>;
  /** The context fit the request gets (same window, reply space and estimate): what it keeps of `messages`. */
  fit(messages: T[]): ReadonlyArray<{ contextKind?: string }>;
  /** Told which history messages recall removed from `prompt`, so the request can still report them as not sent. */
  onHistoryLeftOut?(messages: T[]): void;
}

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

function insertBeforeHistory<T extends PromptMessage>(messages: T[], message: T): void {
  const firstUserIdx = messages.findIndex((entry) => entry.role === "user" || entry.role === "assistant");
  messages.splice(firstUserIdx >= 0 ? firstUserIdx : messages.length, 0, message);
}

/**
 * Fit the prompt with `block` added where memories go, as the request will be fitted. The fit drops history oldest
 * first, so the history it keeps is the newest part. Returns how many history messages it drops and when the
 * messages it keeps were created.
 */
function measureSentHistory<T extends MemoryRecallWindowMessage>(
  window: MemoryRecallPromptWindow<T>,
  block: string,
): { droppedHistory: number; sentTimes: string[] } {
  const history = window.prompt.filter((message) => message.contextKind === "history");
  const probe = [...window.prompt];
  if (block) insertBeforeHistory(probe, { role: "system", content: block } as T);
  const keptHistory = window.fit(probe).filter((message) => message.contextKind === "history").length;
  const droppedHistory = Math.max(0, history.length - keptHistory);
  const sentTimes = history.slice(droppedHistory).flatMap((message) => {
    const createdAt = message.id ? window.messageCreatedAt.get(message.id) : undefined;
    return createdAt ? [createdAt] : [];
  });
  return { droppedHistory, sentTimes: sentTimes.sort() };
}

function removeOldestHistory<T extends MemoryRecallWindowMessage>(messages: T[], count: number): T[] {
  const removed: T[] = [];
  while (removed.length < count) {
    const index = messages.findIndex((message) => message.contextKind === "history");
    if (index < 0) break;
    removed.push(...messages.splice(index, 1));
  }
  return removed;
}

export async function injectMemoryRecallContext<T extends MemoryRecallWindowMessage = MemoryRecallWindowMessage>({
  db,
  messages,
  currentInputMessages,
  chatId,
  embeddingSource,
  excludeFromMessageAt,
  contextLimit,
  promptWindow,
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
  /** Recall only messages this prompt will not send. Omit to search the whole chat. */
  promptWindow?: MemoryRecallPromptWindow<T>;
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

    // While the whole chat fits, only imported memories can be recalled: measure the prompt as it is first, so room
    // reserved for memories never makes this chat's own messages eligible. Once history is trimmed anyway, memories
    // take room, so measure the history that still fits with a full block in; the messages that make way for it can
    // then be recalled too.
    const budgetTokens = memoryRecallBudgetTokens(contextLimit);
    const unreservedWindow = promptWindow ? measureSentHistory(promptWindow, "") : null;
    const reservedWindow =
      promptWindow && unreservedWindow && unreservedWindow.droppedHistory > 0
        ? measureSentHistory(
            promptWindow,
            buildMemoryRecallBlock([sliceTextToTokenBudget("x".repeat(budgetTokens * 8), budgetTokens)], wrapFormat),
          )
        : unreservedWindow;

    const recalled = await recallMemories(db, lastUserMsg.content, [chatId], {
      embeddingSource,
      excludeFromMessageAt,
      signal,
      ...(reservedWindow ? { sentMessages: { chatId, times: reservedWindow.sentTimes } } : {}),
    });
    if (recalled.length === 0) return [];

    const packedRecall = packRecalledMemories(recalled, contextLimit);
    if (packedRecall.lines.length === 0) {
      logger.debug("[memory-recall] Skipped recalled memories after budgeting (%d candidates)", recalled.length);
      return [];
    }

    // Packing keeps memories in rank order and stops at the first that does not fit, so line i is recalled[i].
    let selected: Array<{ line: string; memory: RecalledMemory }> = packedRecall.lines.map((line, index) => ({
      line: resolveMacros ? resolveMacros(line) : line,
      memory: recalled[index]!,
    }));
    let memoriesBlock = buildMemoryRecallBlock(
      selected.map(({ line }) => line),
      wrapFormat,
    );

    let droppedHistory = 0;
    if (promptWindow) {
      // The block is usually smaller than the room reserved for it, so more history fits. Leave out any memory that
      // history now covers. Each pass only removes memories, so the block shrinks until nothing changes.
      for (;;) {
        const settled = measureSentHistory(promptWindow, memoriesBlock);
        // A chunk stays only if neither the prompt as it is nor the prompt with memories sends any of its messages.
        const kept = selected.filter(
          ({ memory }) =>
            memory.imported ||
            (!chunkCoversSentMessage(memory, settled.sentTimes) &&
              !(unreservedWindow?.droppedHistory === 0 && chunkCoversSentMessage(memory, unreservedWindow.sentTimes))),
        );
        if (kept.length === selected.length) {
          droppedHistory = settled.droppedHistory;
          break;
        }
        selected = kept;
        if (selected.length === 0) return [];
        memoriesBlock = buildMemoryRecallBlock(
          selected.map(({ line }) => line),
          wrapFormat,
        );
      }
    }

    logger.debug(
      "[memory-recall] Injecting %d/%d recalled memories (budget %d tokens)%s%s",
      selected.length,
      recalled.length,
      packedRecall.budgetTokens,
      packedRecall.trimmed ? " after trimming" : "",
      promptWindow ? `, leaving out ${droppedHistory} older history message(s)` : "",
    );

    // The request's own fit would drop the same history. Dropping it now keeps it out even if the prompt later
    // shrinks, so a recalled message is never also sent as history.
    if (promptWindow) {
      const leftOut = removeOldestHistory(promptWindow.prompt, droppedHistory);
      if (leftOut.length > 0) promptWindow.onHistoryLeftOut?.(leftOut);
    }
    // A preset's Memory Recall marker decides where memories go; without one, right before the chat history.
    if (!fillMemoryRecallSlot(messages, memoriesBlock)) {
      insertBeforeHistory(messages, { role: "system", content: memoriesBlock });
    }
    return selected.map(({ line }) => line);
  } catch (err) {
    logger.error(err, "[memory-recall] Recall failed, skipping");
    return [];
  } finally {
    logger.debug(`[timing] Memory recall: ${Date.now() - startedAt}ms`);
  }
}

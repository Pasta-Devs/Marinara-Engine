import { estimateTextTokens as estimateTokens, sliceTextToTokenBudget } from "@marinara-engine/shared";

const DEFAULT_MEMORY_RECALL_BUDGET_TOKENS = 1024;
const MIN_MEMORY_RECALL_BUDGET_TOKENS = 384;
const MAX_MEMORY_RECALL_BUDGET_TOKENS = 1536;
const MAX_RECALLED_MEMORY_TOKENS = 384;
const MIN_RECALLED_MEMORY_TOKENS = 96;
const MEMORY_RECALL_CONTEXT_SHARE = 0.15;
const RECALL_TRUNCATION_MARKER = "\n...[recalled memory truncated]...\n";

function estimateTextTokens(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  return estimateTokens(trimmed);
}

export function truncateRecalledMemory(content: string, tokenBudget: number): string {
  if (estimateTokens(content) <= tokenBudget) return content;
  const availableTokens = Math.floor(tokenBudget) - estimateTokens(RECALL_TRUNCATION_MARKER);
  if (availableTokens <= 0) return sliceTextToTokenBudget(content, tokenBudget);
  const head = sliceTextToTokenBudget(content, Math.ceil(availableTokens * 0.7)).trimEnd();
  const tail = sliceTextToTokenBudget(content, availableTokens - estimateTokens(head), true).trimStart();
  return `${head}${RECALL_TRUNCATION_MARKER}${tail}`;
}

export function packRecalledMemories(
  recalled: Array<{ content: string }>,
  maxContext?: number,
): { lines: string[]; estimatedTokens: number; budgetTokens: number; trimmed: boolean } {
  const targetBudget = maxContext
    ? Math.floor(maxContext * MEMORY_RECALL_CONTEXT_SHARE)
    : DEFAULT_MEMORY_RECALL_BUDGET_TOKENS;
  const budgetTokens = Math.max(
    MIN_MEMORY_RECALL_BUDGET_TOKENS,
    Math.min(MAX_MEMORY_RECALL_BUDGET_TOKENS, targetBudget),
  );

  const lines: string[] = [];
  let estimatedTokens = 0;
  let trimmed = false;

  for (const memory of recalled) {
    const remainingTokens = budgetTokens - estimatedTokens;
    if (remainingTokens < MIN_RECALLED_MEMORY_TOKENS) {
      trimmed = true;
      break;
    }

    const packed = truncateRecalledMemory(memory.content, Math.min(MAX_RECALLED_MEMORY_TOKENS, remainingTokens));
    const packedTokens = estimateTextTokens(packed);
    if (packedTokens <= 0 || packedTokens > remainingTokens) {
      trimmed = true;
      break;
    }

    lines.push(packed);
    estimatedTokens += packedTokens;
    if (packed !== memory.content) trimmed = true;
  }

  return { lines, estimatedTokens, budgetTokens, trimmed };
}

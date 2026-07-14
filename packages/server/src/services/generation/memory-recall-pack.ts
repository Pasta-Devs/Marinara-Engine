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
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

function sliceAtCodePointBoundaries(content: string, start: number, end: number): string {
  let safeStart = Math.max(0, start);
  let safeEnd = Math.min(content.length, end);

  const startsWithLowSurrogate = safeStart > 0 && safeStart < content.length
    && content.charCodeAt(safeStart) >= 0xdc00 && content.charCodeAt(safeStart) <= 0xdfff;
  if (startsWithLowSurrogate) safeStart += 1;

  const endsWithHighSurrogate = safeEnd > 0 && safeEnd < content.length
    && content.charCodeAt(safeEnd - 1) >= 0xd800 && content.charCodeAt(safeEnd - 1) <= 0xdbff;
  if (endsWithHighSurrogate) safeEnd -= 1;

  return content.slice(safeStart, safeEnd);
}

export function truncateRecalledMemory(content: string, tokenBudget: number): string {
  const maxChars = Math.max(32, tokenBudget * 4);
  if (content.length <= maxChars) return content;

  const availableChars = maxChars - RECALL_TRUNCATION_MARKER.length;
  if (availableChars <= 0) {
    return sliceAtCodePointBoundaries(content, 0, maxChars);
  }

  const headChars = Math.max(16, Math.ceil(availableChars * 0.7));
  const tailChars = Math.max(16, availableChars - headChars);
  const head = sliceAtCodePointBoundaries(content, 0, headChars).trimEnd();
  const tail = sliceAtCodePointBoundaries(content, content.length - tailChars, content.length).trimStart();
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

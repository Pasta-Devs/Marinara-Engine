import type { LorebookRole } from "../../contracts/types/lorebook";
import type { ActivatedEntry } from "./keyword-scanner.js";

/** A prompt message ready for injection. */
export interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
  contextKind?: "prompt" | "history" | "injection";
  /** Optional name for multi-character */
  name?: string;
}

/**
 * Build the World Info content blocks from activated entries.
 * Position 0 = WORLD_INFO_BEFORE (before character defs)
 * Position 1 = WORLD_INFO_AFTER (after character defs)
 */
export function buildWorldInfoBlocks(activatedEntries: ActivatedEntry[]): {
  before: string;
  after: string;
} {
  const beforeParts: string[] = [];
  const afterParts: string[] = [];

  // Sort by order
  const sorted = [...activatedEntries].sort((a, b) => a.entry.order - b.entry.order);

  for (const { entry } of sorted) {
    if (entry.position <= 0) {
      beforeParts.push(entry.content);
    } else if (entry.position === 1) {
      afterParts.push(entry.content);
    }
    // position >= 2 entries are handled by getDepthInjectedEntries
  }

  return {
    before: beforeParts.join("\n\n"),
    after: afterParts.join("\n\n"),
  };
}

/**
 * Get entries that should be injected at specific depths in the message array.
 * Only entries with position >= 2 (depth injection mode) are included.
 * Position 0/1 entries always go to worldInfoBefore/After via buildWorldInfoBlocks.
 */
export function getDepthInjectedEntries(activatedEntries: ActivatedEntry[]): Array<{
  content: string;
  role: LorebookRole;
  depth: number;
  order: number;
}> {
  return activatedEntries
    .filter((a) => a.entry.position >= 2 && a.entry.depth >= 0)
    .map((a) => ({
      content: a.entry.content,
      role: a.entry.role,
      depth: a.entry.depth,
      order: a.entry.order,
    }))
    .sort((a, b) => {
      // Same depth: sort by order
      if (a.depth === b.depth) return a.order - b.order;
      return a.depth - b.depth;
    });
}

/**
 * Inject depth-based entries into a message array.
 * Depth 0 = after the last message, depth 1 = before the last message, etc.
 */
export function injectAtDepth(
  messages: PromptMessage[],
  depthEntries: Array<{ content: string; role: LorebookRole; depth: number }>,
): PromptMessage[] {
  if (depthEntries.length === 0) return messages;

  const result = [...messages];

  // Group entries by depth
  const byDepth = new Map<number, Array<{ content: string; role: LorebookRole }>>();
  for (const entry of depthEntries) {
    const list = byDepth.get(entry.depth) ?? [];
    list.push({ content: entry.content, role: entry.role });
    byDepth.set(entry.depth, list);
  }

  // Process depths from highest to lowest (to preserve indices)
  const depths = [...byDepth.keys()].sort((a, b) => b - a);

  for (const depth of depths) {
    const entries = byDepth.get(depth) ?? [];
    const insertionIndex = Math.max(0, result.length - depth);

    // Insert all entries for this depth at the same position
    const toInsert: PromptMessage[] = entries.map((e) => ({
      role: e.role,
      content: e.content,
      contextKind: "injection",
    }));

    result.splice(insertionIndex, 0, ...toInsert);
  }

  return result;
}

/**
 * Apply token budget to activated entries.
 * Trims entries (by priority/order) until total tokens are within budget.
 * Uses a rough estimate of 4 characters per token.
 */
export function applyTokenBudget(activatedEntries: ActivatedEntry[], tokenBudget: number): ActivatedEntry[] {
  return applyTokenBudgetWithSkipped(activatedEntries, tokenBudget).includedEntries;
}

export interface BudgetSkippedActivatedEntry {
  activatedEntry: ActivatedEntry;
  estimatedTokens: number;
  usedTokensBefore: number;
}

/**
 * Apply the same budget ordering as applyTokenBudget, while preserving the
 * entries that were dropped so callers can surface budget diagnostics.
 */
export function applyTokenBudgetWithSkipped(
  activatedEntries: ActivatedEntry[],
  tokenBudget: number,
): {
  includedEntries: ActivatedEntry[];
  skippedEntries: BudgetSkippedActivatedEntry[];
  totalTokensEstimate: number;
} {
  if (tokenBudget <= 0) {
    const totalChars = activatedEntries.reduce((sum, entry) => sum + entry.entry.content.length, 0);
    return {
      includedEntries: activatedEntries,
      skippedEntries: [],
      totalTokensEstimate: Math.ceil(totalChars / 4),
    };
  }

  const CHARS_PER_TOKEN = 4;
  let totalTokens = 0;
  let budgetExhausted = false;
  const includedEntries: ActivatedEntry[] = [];
  const skippedEntries: BudgetSkippedActivatedEntry[] = [];

  // Sort: constant entries first, then by order
  const sorted = [...activatedEntries].sort((a, b) => {
    if (a.entry.constant && !b.entry.constant) return -1;
    if (!a.entry.constant && b.entry.constant) return 1;
    return a.entry.order - b.entry.order;
  });

  for (const entry of sorted) {
    const estimatedTokens = Math.ceil(entry.entry.content.length / CHARS_PER_TOKEN);
    if (budgetExhausted || totalTokens + estimatedTokens > tokenBudget) {
      budgetExhausted = true;
      skippedEntries.push({ activatedEntry: entry, estimatedTokens, usedTokensBefore: totalTokens });
      continue;
    }
    totalTokens += estimatedTokens;
    includedEntries.push(entry);
  }

  return {
    includedEntries,
    skippedEntries,
    totalTokensEstimate: totalTokens,
  };
}

/**
 * Full pipeline: process activated entries into injectable content.
 */
export function processActivatedEntries(
  activatedEntries: ActivatedEntry[],
  tokenBudget: number = 0,
): {
  worldInfoBefore: string;
  worldInfoAfter: string;
  depthEntries: Array<{ content: string; role: LorebookRole; depth: number; order: number }>;
  includedEntries: ActivatedEntry[];
  skippedEntries: BudgetSkippedActivatedEntry[];
  totalEntries: number;
  totalTokensEstimate: number;
} {
  // Apply budget
  const budgeted = applyTokenBudgetWithSkipped(activatedEntries, tokenBudget);
  const includedEntries = budgeted.includedEntries;

  // Build blocks
  const { before, after } = buildWorldInfoBlocks(includedEntries);

  // Get depth entries
  const depthEntries = getDepthInjectedEntries(includedEntries);

  return {
    worldInfoBefore: before,
    worldInfoAfter: after,
    depthEntries,
    includedEntries,
    skippedEntries: budgeted.skippedEntries,
    totalEntries: includedEntries.length,
    totalTokensEstimate: budgeted.totalTokensEstimate,
  };
}

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

export interface InjectAtDepthOptions {
  /** Lowest prompt index a depth entry may be inserted at. */
  minIndex?: number;
  /** Prompt index depth entries count back from. Defaults to the full prompt length. */
  anchorIndex?: number;
}

/**
 * Build the World Info content blocks from activated entries.
 * Position 0 = WORLD_INFO_BEFORE (before character defs)
 * Position 1 = WORLD_INFO_AFTER (after character defs)
 */
function buildWorldInfoBlocks(activatedEntries: ActivatedEntry[]): {
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
function getDepthInjectedEntries(activatedEntries: ActivatedEntry[]): Array<{
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
  options: InjectAtDepthOptions = {},
): PromptMessage[] {
  if (depthEntries.length === 0) return messages;

  const anchorIndex = Math.max(0, Math.min(messages.length, Math.floor(options.anchorIndex ?? messages.length)));
  const minIndex = Math.max(0, Math.min(anchorIndex, Math.floor(options.minIndex ?? 0)));
  const byInsertionIndex = new Map<number, Array<{ content: string; role: LorebookRole }>>();
  for (const entry of depthEntries) {
    const depth = Math.max(0, Math.floor(entry.depth));
    const insertionIndex = Math.max(minIndex, anchorIndex - depth);
    const list = byInsertionIndex.get(insertionIndex) ?? [];
    list.push({ content: entry.content, role: entry.role });
    byInsertionIndex.set(insertionIndex, list);
  }

  const result: PromptMessage[] = [];
  for (let index = 0; index <= messages.length; index += 1) {
    const entries = byInsertionIndex.get(index) ?? [];
    result.push(
      ...entries.map((entry) => ({
        role: entry.role,
        content: entry.content,
        contextKind: "injection" as const,
      })),
    );

    const message = messages[index];
    if (message) result.push(message);
  }

  return result;
}

/**
 * Apply token budget to activated entries.
 * Trims entries (by priority/order) until total tokens are within budget.
 * Uses a rough estimate of 4 characters per token.
 */
export interface BudgetSkippedActivatedEntry {
  activatedEntry: ActivatedEntry;
  estimatedTokens: number;
  usedTokensBefore: number;
}

export interface LorebookContentResolver {
  resolve(content: string): string;
  snapshotVariables?(): () => void;
}

function withResolvedContent(entry: ActivatedEntry, resolver?: LorebookContentResolver): ActivatedEntry {
  if (!resolver) return entry;
  const rawContent = entry.rawContent ?? entry.entry.content;
  const content = resolver.resolve(rawContent);
  return {
    ...entry,
    rawContent,
    entry: {
      ...entry.entry,
      content,
    },
  };
}

function compareByLorebookBudgetPriority(a: ActivatedEntry, b: ActivatedEntry): number {
  if (a.entry.constant && !b.entry.constant) return -1;
  if (!a.entry.constant && b.entry.constant) return 1;
  if (a.matchedLatestUserMessage && !b.matchedLatestUserMessage) return -1;
  if (!a.matchedLatestUserMessage && b.matchedLatestUserMessage) return 1;
  return a.entry.order - b.entry.order;
}

function applyEntryCountCap(activatedEntries: ActivatedEntry[], maxEntries: number): ActivatedEntry[] {
  const entryLimit = Math.max(0, Math.floor(maxEntries));
  if (!Number.isFinite(entryLimit) || activatedEntries.length <= entryLimit) return activatedEntries;
  return [...activatedEntries].sort(compareByLorebookBudgetPriority).slice(0, entryLimit);
}

/**
 * Apply token-budget ordering while preserving the
 * entries that were dropped so callers can surface budget diagnostics.
 */
function applyTokenBudgetWithSkipped(
  activatedEntries: ActivatedEntry[],
  tokenBudget: number,
  resolver?: LorebookContentResolver,
): {
  includedEntries: ActivatedEntry[];
  skippedEntries: BudgetSkippedActivatedEntry[];
  totalTokensEstimate: number;
} {
  if (tokenBudget <= 0) {
    const includedEntries = activatedEntries.map((entry) => withResolvedContent(entry, resolver));
    const totalChars = includedEntries.reduce((sum, entry) => sum + entry.entry.content.length, 0);
    return {
      includedEntries,
      skippedEntries: [],
      totalTokensEstimate: Math.ceil(totalChars / 4),
    };
  }

  const CHARS_PER_TOKEN = 4;
  let totalTokens = 0;
  let budgetExhausted = false;
  const includedEntries: ActivatedEntry[] = [];
  const skippedEntries: BudgetSkippedActivatedEntry[] = [];

  // Sort: constant entries first, then fresh user-turn matches, then by order
  const sorted = [...activatedEntries].sort(compareByLorebookBudgetPriority);

  for (const entry of sorted) {
    const resolvedEntry = withResolvedContent(entry, resolver);
    const estimatedTokens = Math.ceil(resolvedEntry.entry.content.length / CHARS_PER_TOKEN);
    if (budgetExhausted || totalTokens + estimatedTokens > tokenBudget) {
      budgetExhausted = true;
      skippedEntries.push({ activatedEntry: resolvedEntry, estimatedTokens, usedTokensBefore: totalTokens });
      continue;
    }
    totalTokens += estimatedTokens;
    includedEntries.push(resolvedEntry);
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
  resolver?: LorebookContentResolver,
  maxEntries: number = Number.POSITIVE_INFINITY,
): {
  worldInfoBefore: string;
  worldInfoAfter: string;
  depthEntries: Array<{ content: string; role: LorebookRole; depth: number; order: number }>;
  includedEntries: ActivatedEntry[];
  skippedEntries: BudgetSkippedActivatedEntry[];
  totalEntries: number;
  totalTokensEstimate: number;
} {
  const cappedEntries = applyEntryCountCap(activatedEntries, maxEntries);

  // Apply budget
  const budgeted = applyTokenBudgetWithSkipped(cappedEntries, tokenBudget, resolver);
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

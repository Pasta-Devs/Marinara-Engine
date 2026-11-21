// ──────────────────────────────────────────────
// Lorebook: Prompt Injector
// Takes activated lorebook entries and injects
// them into the prompt at the correct positions
// (WORLD_INFO_BEFORE / WORLD_INFO_AFTER / depth).
// ──────────────────────────────────────────────
import { estimateTextTokens, type LorebookRole } from "@marinara-engine/shared";
import type { LorebookImageEntry } from "../generation/lorebook-image-prompt.js";
import type { ActivatedEntry } from "./keyword-scanner.js";

/** Same per-image estimate used by provider context fitting. */
function estimateLorebookImageTokens(images: Array<{ caption: string }> = []): number {
  return images.reduce((tokens, image) => tokens + 256 + estimateTextTokens(image.caption), 0);
}

export function estimateLorebookEntryTokens(entry: { content: string; images?: Array<{ caption: string }> }): number {
  return estimateTextTokens(entry.content) + estimateLorebookImageTokens(entry.images);
}

/** Fit an entry into a budget, dropping its images before its text so text-only retries keep the lore. */
export function fitLorebookEntryToBudget(
  candidate: ActivatedEntry,
  fits: (tokens: number) => boolean,
  includeImages = true,
): { candidate: ActivatedEntry; tokens: number } | null {
  const textTokens = estimateTextTokens(candidate.entry.content);
  if (!candidate.entry.content.trim() && !candidate.entry.images?.length) return null;
  if (candidate.entry.content.trim() && !fits(textTokens)) return null;
  const images = [] as NonNullable<ActivatedEntry["entry"]["images"]>;
  let tokens = candidate.entry.content.trim() ? textTokens : 0;
  for (const image of includeImages ? (candidate.entry.images ?? []) : []) {
    const imageTokens = estimateLorebookImageTokens([image]);
    if (!fits(tokens + imageTokens)) continue;
    images.push(image);
    tokens += imageTokens;
  }
  if (tokens === 0 && images.length === 0) return null;
  return {
    candidate:
      images.length === (candidate.entry.images?.length ?? 0)
        ? candidate
        : { ...candidate, entry: { ...candidate.entry, images } },
    tokens,
  };
}

/** A prompt message ready for injection. */
export interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
  contextKind?: "prompt" | "history" | "injection";
  /** Optional name for multi-character */
  name?: string;
}

export interface InjectAtDepthOptions {
  /** Earliest index an entry may be inserted at. */
  minIndex?: number;
  /** Index considered "after the last message" for depth 0. Defaults to the full prompt length. */
  anchorIndex?: number;
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
    // Position 2 entries are handled by getDepthInjectedEntries.
    // Position 7 entries are named Outlets and are never injected automatically.
  }

  return {
    before: beforeParts.join("\n\n"),
    after: afterParts.join("\n\n"),
  };
}

/**
 * Get entries that should be injected at specific depths in the message array.
 * Only entries with position 2 (depth injection mode) are included.
 * Position 0/1 entries always go to worldInfoBefore/After via buildWorldInfoBlocks.
 */
export function getDepthInjectedEntries(activatedEntries: ActivatedEntry[]): Array<{
  content: string;
  role: LorebookRole;
  depth: number;
  order: number;
}> {
  return activatedEntries
    .filter((a) => a.entry.position === 2 && a.entry.depth >= 0)
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
 * Depth 0 = after the latest message, depth 1 = before the last message, etc.
 */
export function injectAtDepth(
  messages: PromptMessage[],
  depthEntries: Array<{ content: string; role: LorebookRole; depth: number }>,
  options: InjectAtDepthOptions = {},
): PromptMessage[] {
  if (depthEntries.length === 0) return messages;

  const result = [...messages];
  const baseLength = messages.length;
  const minIndex = Math.min(Math.max(0, options.minIndex ?? 0), baseLength);
  const anchorIndex = Math.min(Math.max(minIndex, options.anchorIndex ?? baseLength), baseLength);

  // Group entries by the final original-array insertion index. Computing
  // all targets before splicing keeps depth 0 anchored after the original
  // last message even when deeper entries are inserted earlier.
  const byIndex = new Map<number, Array<{ content: string; role: LorebookRole; depth: number; order: number }>>();
  for (const [order, entry] of depthEntries.entries()) {
    const depth = Number.isFinite(entry.depth) ? Math.max(0, Math.floor(entry.depth)) : 0;
    const insertionIndex = Math.max(minIndex, anchorIndex - depth);
    const list = byIndex.get(insertionIndex) ?? [];
    list.push({ content: entry.content, role: entry.role, depth, order });
    byIndex.set(insertionIndex, list);
  }

  // Process later original indices first so earlier insertions do not shift them.
  const insertionIndexes = [...byIndex.keys()].sort((a, b) => b - a);

  for (const insertionIndex of insertionIndexes) {
    const entries = (byIndex.get(insertionIndex) ?? []).sort((a, b) => a.depth - b.depth || a.order - b.order);

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
 * Uses the shared lightweight token estimator.
 */
export function applyTokenBudget(activatedEntries: ActivatedEntry[], tokenBudget: number): ActivatedEntry[] {
  if (tokenBudget <= 0) return activatedEntries;

  let totalTokens = 0;
  const result: ActivatedEntry[] = [];

  // Sort: constant entries first, then by order
  const sorted = [...activatedEntries].sort((a, b) => {
    if (a.entry.constant && !b.entry.constant) return -1;
    if (!a.entry.constant && b.entry.constant) return 1;
    return a.entry.order - b.entry.order;
  });

  for (const entry of sorted) {
    const fitted = fitLorebookEntryToBudget(entry, (tokens) => totalTokens + tokens <= tokenBudget, false);
    if (!fitted) continue;
    totalTokens += fitted.tokens;
    result.push(fitted.candidate);
  }

  for (const [index, entry] of result.entries()) {
    const original = sorted.find((candidate) => candidate.entry.id === entry.entry.id) ?? entry;
    const fitted = fitLorebookEntryToBudget(
      original,
      (tokens) => totalTokens - estimateTextTokens(entry.entry.content) + tokens <= tokenBudget,
    );
    if (!fitted) continue;
    totalTokens += fitted.tokens - estimateTextTokens(entry.entry.content);
    result[index] = fitted.candidate;
  }

  return result;
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
  outlets: Record<string, string>;
  imageEntries?: LorebookImageEntry[];
  totalEntries: number;
  totalTokensEstimate: number;
} {
  // Apply budget
  // Legacy unnamed outlets have no injection target and must not count as included.
  const budgeted = applyTokenBudget(
    activatedEntries.filter(({ entry }) => entry.position !== 7 || Boolean(entry.outletName?.trim())),
    tokenBudget,
  );

  // Build blocks
  const { before, after } = buildWorldInfoBlocks(budgeted);

  // Get depth entries
  const depthEntries = getDepthInjectedEntries(budgeted);

  // Outlet names are deliberately exact and case-sensitive. Activated entries
  // with the same name are joined in insertion order, but are not injected at
  // any automatic lorebook position.
  const outletParts = new Map<string, string[]>();
  for (const { entry } of [...budgeted].sort((a, b) => a.entry.order - b.entry.order)) {
    if (entry.position !== 7 || !entry.outletName) continue;
    const parts = outletParts.get(entry.outletName) ?? [];
    parts.push(entry.content);
    outletParts.set(entry.outletName, parts);
  }
  const outlets = Object.fromEntries(Array.from(outletParts, ([name, parts]) => [name, parts.join("\n")]));

  // Estimate tokens
  const totalTokensEstimate =
    estimateTextTokens(budgeted.map((a) => a.entry.content).join("")) +
    budgeted.reduce((tokens, a) => tokens + estimateLorebookImageTokens(a.entry.images), 0);

  return {
    worldInfoBefore: before,
    worldInfoAfter: after,
    depthEntries,
    outlets,
    ...(budgeted.some(({ entry }) => entry.images?.length)
      ? {
          imageEntries: budgeted
            .filter(({ entry }) => entry.images?.length)
            .map(({ entry }) => ({
              id: entry.id,
              name: entry.name,
              content: entry.content,
              position: entry.position,
              outletName: entry.outletName,
              images: entry.images!,
            })),
        }
      : {}),
    totalEntries: budgeted.length,
    totalTokensEstimate,
  };
}

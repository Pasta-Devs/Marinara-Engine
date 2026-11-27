// Where a lorebook entry lands in the prompt, as a sort key, so lists that say "Order" match
// what the model actually reads (prompt-injector.ts). Order only ranks entries that share a
// placement: every "Before character definitions" entry sits above every "After" one, whatever
// their numbers, as long as the preset keeps its Before marker above its After marker (the
// built-in presets do). Depth entries go into the chat history, deepest first; Outlet entries
// appear wherever their {{outlet::name}} macro is, so they sort last.

import type { LorebookEntry } from "../types/lorebook.js";

export type LorebookPromptPlacement = "before" | "after" | "depth" | "outlet";

export type PromptOrderableLorebookEntry = Partial<Pick<LorebookEntry, "position" | "depth" | "order" | "name">>;

/** The prompt section an entry goes to (position 0 or below = Before, like the injector). */
export function lorebookPromptPlacement(
  entry: Pick<PromptOrderableLorebookEntry, "position">,
): LorebookPromptPlacement {
  const position = Number(entry.position ?? 0);
  if (!(position > 0)) return "before";
  if (position === 1) return "after";
  if (position === 2) return "depth";
  return "outlet";
}

const PLACEMENT_RANK: Record<LorebookPromptPlacement, number> = { before: 0, after: 1, depth: 2, outlet: 3 };

/**
 * Sorts entries by where they land in the prompt: Before, then After, then depth entries from
 * the deepest (earliest in the chat) to depth 0, then Outlets; Order breaks ties inside each.
 */
export function compareLorebookEntriesByPromptOrder(
  a: PromptOrderableLorebookEntry,
  b: PromptOrderableLorebookEntry,
): number {
  const placementA = lorebookPromptPlacement(a);
  const placementB = lorebookPromptPlacement(b);
  const rank = PLACEMENT_RANK[placementA] - PLACEMENT_RANK[placementB];
  if (rank !== 0) return rank;
  if (placementA === "depth") {
    const depth = (Number(b.depth) || 0) - (Number(a.depth) || 0);
    if (depth !== 0) return depth;
  }
  return (Number(a.order) || 0) - (Number(b.order) || 0);
}

/** True when two entries share one prompt spot (same section, and the same depth for depth entries). */
export function sameLorebookPromptSpot(a: PromptOrderableLorebookEntry, b: PromptOrderableLorebookEntry): boolean {
  const placement = lorebookPromptPlacement(a);
  if (placement !== lorebookPromptPlacement(b)) return false;
  return placement !== "depth" || (Number(a.depth) || 0) === (Number(b.depth) || 0);
}

/**
 * Where a dragged entry may go in a prompt-ordered list: a drag only renumbers Order, so it can only
 * move the entry among entries at the same prompt spot. `insertAt` is the index in the list without
 * the moved entry; the result is clamped to that spot's run (or `from` when the entry is alone there).
 */
export function clampLorebookEntryMoveToPromptSpot(
  list: readonly PromptOrderableLorebookEntry[],
  from: number,
  insertAt: number,
): number {
  const moved = list[from];
  if (!moved) return insertAt;
  const rest = list.filter((_, index) => index !== from);
  const first = rest.findIndex((entry) => sameLorebookPromptSpot(entry, moved));
  if (first < 0) return from;
  let last = first;
  while (last + 1 < rest.length && sameLorebookPromptSpot(rest[last + 1]!, moved)) last++;
  return Math.min(Math.max(insertAt, first), last + 1);
}

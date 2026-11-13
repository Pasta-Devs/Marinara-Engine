import type { VirtualItem } from "@tanstack/react-virtual";

/** Last-row distance (in rows) from the end at which a paged panel asks for its next page. */
export const NEAR_END_ROWS = 2;

export interface NearEndInput {
  lastVisibleIndex: number | undefined;
  count: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
}

/** True when a paged virtual list should fetch its next page. A failed page stops the loop (manual retry). */
export function shouldFetchNextPage(input: NearEndInput): boolean {
  const { lastVisibleIndex, count, hasNextPage, isFetchingNextPage, isFetchNextPageError } = input;
  if (!hasNextPage || isFetchingNextPage || isFetchNextPageError) return false;
  // An empty list (e.g. a page of only foldered rows) still needs more pages to show anything.
  if (count === 0) return true;
  return lastVisibleIndex !== undefined && lastVisibleIndex >= count - 1 - NEAR_END_ROWS;
}

/** Keeps one row (a dragged card) in the rendered range so its drag handlers outlive scrolling it away. */
export function withPinnedIndex(indexes: number[], pinnedIndex: number | undefined): number[] {
  if (pinnedIndex === undefined || pinnedIndex < 0 || indexes.includes(pinnedIndex)) return indexes;
  return [pinnedIndex, ...indexes];
}

// Measured row heights per list, so a remounted panel lands on the same row instead of re-estimating.
const measurementSnapshots = new Map<string, VirtualItem[]>();

export function loadMeasurementSnapshot(listKey: string): VirtualItem[] {
  return measurementSnapshots.get(listKey) ?? [];
}

export function saveMeasurementSnapshot(listKey: string, items: VirtualItem[]): void {
  measurementSnapshots.set(listKey, items);
}

/** Nearest scrollable ancestor (the panel's scroll container), or null when the page itself scrolls. */
export function findScrollParent(node: Element): HTMLElement | null {
  let root = node.parentElement;
  while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
  return root;
}

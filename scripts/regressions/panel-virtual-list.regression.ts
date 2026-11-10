// Shared side-panel virtual list (Characters / Personas / Lorebooks): pins the pure helpers it relies on —
// when a paged list asks for its next page, how the dragged row stays mounted, and the per-list measurement snapshots.
import assert from "node:assert/strict";
import type { VirtualItem } from "@tanstack/react-virtual";
import {
  loadMeasurementSnapshot,
  saveMeasurementSnapshot,
  shouldFetchNextPage,
  withPinnedIndex,
} from "../../packages/client/src/lib/panel-virtual-list";

const base = { count: 20, hasNextPage: true, isFetchingNextPage: false, isFetchNextPageError: false };

// Near-end: fetch when the last rendered row is within 2 rows of the end, not before.
assert.equal(shouldFetchNextPage({ ...base, lastVisibleIndex: 17 }), true);
assert.equal(shouldFetchNextPage({ ...base, lastVisibleIndex: 19 }), true);
assert.equal(shouldFetchNextPage({ ...base, lastVisibleIndex: 16 }), false);
// Never while a page is loading, after a failed page (manual retry only), or with no next page.
assert.equal(shouldFetchNextPage({ ...base, lastVisibleIndex: 19, isFetchingNextPage: true }), false);
assert.equal(shouldFetchNextPage({ ...base, lastVisibleIndex: 19, isFetchNextPageError: true }), false);
assert.equal(shouldFetchNextPage({ ...base, lastVisibleIndex: 19, hasNextPage: false }), false);
// An empty list (a page of only foldered rows) keeps loading; a missing range on a non-empty list does not.
assert.equal(shouldFetchNextPage({ ...base, count: 0, lastVisibleIndex: undefined }), true);
assert.equal(
  shouldFetchNextPage({ ...base, count: 0, lastVisibleIndex: undefined, isFetchNextPageError: true }),
  false,
);
assert.equal(shouldFetchNextPage({ ...base, lastVisibleIndex: undefined }), false);

// Dragged row: added when scrolled out of range, never duplicated, ignored when absent (-1 / undefined).
assert.deepEqual(withPinnedIndex([3, 4, 5], 9), [9, 3, 4, 5]);
assert.deepEqual(withPinnedIndex([3, 4, 5], 4), [3, 4, 5]);
assert.deepEqual(withPinnedIndex([3, 4, 5], -1), [3, 4, 5]);
assert.deepEqual(withPinnedIndex([3, 4, 5], undefined), [3, 4, 5]);

// Measurement snapshots are per list key and survive until overwritten.
const row = { index: 0, key: "a", start: 0, end: 80, size: 80, lane: 0 } as VirtualItem;
assert.deepEqual(loadMeasurementSnapshot("test:unknown"), []);
saveMeasurementSnapshot("test:one", [row]);
assert.deepEqual(loadMeasurementSnapshot("test:one"), [row]);
assert.deepEqual(loadMeasurementSnapshot("test:two"), []);

console.log("panel-virtual-list regression passed");

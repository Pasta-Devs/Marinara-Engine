// Shared side-panel virtual list (Characters / Personas / Lorebooks): pins the pure helpers it relies on —
// when a paged list asks for its next page, how the dragged row stays mounted, the per-list measurement snapshots,
// and that a list mounting in an already scrolled container leaves it where it is.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { VirtualItem } from "@tanstack/react-virtual";
import {
  loadMeasurementSnapshot,
  observeCurrentOffset,
  saveMeasurementSnapshot,
  shouldFetchNextPage,
  withPinnedIndex,
} from "../../../packages/client/src/lib/panel-virtual-list";

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
assert.deepEqual(withPinnedIndex([3, 4, 5], 9), [3, 4, 5, 9]);
assert.deepEqual(withPinnedIndex(withPinnedIndex([3, 4, 5], 9), 1), [1, 3, 4, 5, 9]);
assert.deepEqual(withPinnedIndex([3, 4, 5], 4), [3, 4, 5]);
assert.deepEqual(withPinnedIndex([3, 4, 5], -1), [3, 4, 5]);
assert.deepEqual(withPinnedIndex([3, 4, 5], undefined), [3, 4, 5]);

// Measurement snapshots are per list key and survive until overwritten.
const row = { index: 0, key: "a", start: 0, end: 80, size: 80, lane: 0 } as VirtualItem;
assert.deepEqual(loadMeasurementSnapshot("test:unknown"), []);
saveMeasurementSnapshot("test:one", [row]);
assert.deepEqual(loadMeasurementSnapshot("test:one"), [row]);
assert.deepEqual(loadMeasurementSnapshot("test:two"), []);

// A list mounting in a scrolled container (the sprite grid remounting on Full-body, a phone's page-long scroll) keeps
// the container's position. TanStack's own observer reads it only on the next scroll, so the virtualizer scrolled the
// container to 0 as it attached, and the page jumped to the character's top.
const requireClient = createRequire(new URL("../../../packages/client/package.json", import.meta.url));
const { Virtualizer, observeElementOffset } = requireClient(
  "@tanstack/react-virtual",
) as typeof import("@tanstack/react-virtual");
function attachTo(observe: typeof observeElementOffset) {
  const writes: number[] = [];
  const view = { setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} };
  const element = {
    scrollTop: 600,
    ownerDocument: { defaultView: view },
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLElement;
  // As in PanelVirtualList: no container on the first render, which reads the offset, then the container.
  let scroller: HTMLElement | null = null;
  const virtualizer = new Virtualizer<HTMLElement, Element>({
    count: 20,
    estimateSize: () => 180,
    getScrollElement: () => scroller,
    scrollToFn: (offset) => void writes.push(offset),
    observeElementRect: (_instance, cb) => {
      cb({ width: 360, height: 640 });
      return () => {};
    },
    observeElementOffset: observe,
  });
  virtualizer._willUpdate();
  virtualizer.getVirtualItems();
  scroller = element;
  virtualizer._willUpdate();
  virtualizer.cleanup();
  return writes;
}
assert.deepEqual(attachTo(observeElementOffset), [0], "the library's own observer scrolls a scrolled container to 0");
assert.deepEqual(attachTo(observeCurrentOffset), [600], "the list keeps the container where it is");

console.log("panel-virtual-list regression passed");

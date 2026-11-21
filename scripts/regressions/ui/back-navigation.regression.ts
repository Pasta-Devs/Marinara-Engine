import assert from "node:assert/strict";

// The back-navigation entries are what make the Android hardware/gesture back
// button and Safari's swipe dismiss an overlay instead of leaving the app. Their
// whole job is bookkeeping — keep one history entry per open layer, and never
// mistake our own cleanup pop for a user press. These checks pin that
// bookkeeping; the failure modes it guards against (double-pop, stack leak) are
// invisible in a browser until the back stack is already wrong.

class FakeHistory {
  /** History entries' states; index 0 is the page's own entry. */
  entries: unknown[] = [null];
  index = 0;
  pushes = 0;
  private queue: Array<() => void> = [];
  private listeners = new Set<(event: { state: unknown }) => void>();

  get depth() {
    return this.index;
  }

  get state() {
    return this.entries[this.index] ?? null;
  }

  pushState(state: unknown) {
    this.entries = [...this.entries.slice(0, this.index + 1), state];
    this.index += 1;
    this.pushes += 1;
  }

  private move(delta: number) {
    this.index = Math.max(0, Math.min(this.entries.length - 1, this.index + delta));
    for (const listener of [...this.listeners]) listener({ state: this.state });
  }

  /** `history.back()` / `go()` are asynchronous — the popstate lands on a later task. */
  back() {
    this.go(-1);
  }

  go(delta: number) {
    this.queue.push(() => this.move(delta));
  }

  addListener(listener: (event: { state: unknown }) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (event: { state: unknown }) => void) {
    this.listeners.delete(listener);
  }

  listenerCount() {
    return this.listeners.size;
  }

  /** Deliver every queued pop, including any queued while draining. */
  flush() {
    let guard = 0;
    while (this.queue.length) {
      assert.ok((guard += 1) < 50, "history queue never drained");
      const task = this.queue.shift()!;
      task();
    }
  }

  /** A user pressing back: pop and notify, synchronously. */
  userBack() {
    if (this.index === 0) return;
    this.move(-1);
    this.flush();
  }

  /** A user pressing forward. */
  userForward() {
    this.move(1);
    this.flush();
  }
}

let history = new FakeHistory();

type PopListener = (event: { state: unknown }) => void;

const fakeWindow = {
  history: {
    pushState: (state: unknown) => history.pushState(state),
    back: () => history.back(),
    go: (delta: number) => history.go(delta),
    get state() {
      return history.state;
    },
  },
  addEventListener: (type: string, listener: PopListener) => {
    if (type === "popstate") history.addListener(listener);
  },
  removeEventListener: (type: string, listener: PopListener) => {
    if (type === "popstate") history.removeListener(listener);
  },
};

(globalThis as Record<string, unknown>).window = fakeWindow;

const { initBackNavigation, syncBackNavigation, registerBackLayer, getBackLayerStack, __resetBackNavigationForTests } =
  await import("../../../packages/client/src/lib/back-navigation.js");

type Layer = { id: string; close: () => void };

let storeLayers: Layer[] = [];

function reset() {
  __resetBackNavigationForTests();
  history = new FakeHistory();
  storeLayers = [];
  initBackNavigation(() => storeLayers);
}

/** Opens a store-derived layer that removes itself when closed. */
function openLayer(id: string, onClose?: () => void): { closed: number } {
  const record = { closed: 0 };
  storeLayers.push({
    id,
    close: () => {
      record.closed += 1;
      storeLayers = storeLayers.filter((layer) => layer.id !== id);
      onClose?.();
      syncBackNavigation();
    },
  });
  syncBackNavigation();
  return record;
}

// ── 1. Nothing open: back is not ours ──
reset();
syncBackNavigation();
assert.equal(history.pushes, 0, "arming with an empty stack");
assert.equal(history.depth, 0);
history.userBack();
assert.equal(history.depth, 0, "a press with nothing open must fall through");

// ── 2. One layer arms exactly one entry, and only one ──
reset();
openLayer("sidebar");
assert.equal(history.pushes, 1);
syncBackNavigation();
syncBackNavigation();
assert.equal(history.pushes, 1, "sync is idempotent");
assert.equal(history.depth, 1);

// ── 3. Back closes the layer and pushes nothing ──
const sidebar = openLayer("second"); // stack: sidebar, second
assert.equal(history.depth, 2, "one entry per layer");
history.userBack();
assert.equal(sidebar.closed, 1, "topmost layer closed");
assert.equal(getBackLayerStack().length, 1, "only the topmost closes");
// ── 4. …and the remaining layer keeps its own entry, pushed when it opened ──
assert.equal(history.depth, 1, "the remaining layer is still covered");
assert.equal(history.pushes, 2, "no entry re-pushed after a press (Safari skips those)");

// ── 5. Closing through the UI consumes the sentinel without closing a layer ──
reset();
const viaUi = openLayer("panel");
assert.equal(history.depth, 1);
storeLayers = [];
syncBackNavigation(); // the UI closed it; disarm
history.flush(); // deliver the self-pop
assert.equal(viaUi.closed, 0, "self-pop must not close a layer (selfPop guard)");
assert.equal(history.depth, 0, "sentinel consumed, not leaked");

// ── 6. Repeated open/close cycles do not grow the stack ──
reset();
for (let cycle = 0; cycle < 5; cycle += 1) {
  openLayer(`cycle-${cycle}`);
  assert.equal(history.depth, 1, "one entry for the one layer");
  storeLayers = [];
  syncBackNavigation();
  history.flush();
  assert.equal(history.depth, 0, `cycle ${cycle} leaked a history entry`);
}

// ── 7. A press while disarmed is ignored ──
reset();
const ignored = openLayer("ghost");
storeLayers = []; // layer vanished without a sync
history.userBack();
assert.equal(ignored.closed, 0);

// ── 8. Two layers closing in one update disarms exactly once ──
reset();
openLayer("a");
openLayer("b");
assert.equal(history.depth, 2);
storeLayers = [];
syncBackNavigation();
history.flush();
assert.equal(history.depth, 0, "disarmed exactly once for a multi-layer close");

// ── 9. Double init registers one listener ──
reset();
initBackNavigation(() => storeLayers);
initBackNavigation(() => storeLayers);
assert.equal(history.listenerCount(), 1, "duplicate popstate listeners");

// ── 10. A throwing close leaves the sentinel usable ──
reset();
storeLayers.push({
  id: "explodes",
  close: () => {
    throw new Error("boom");
  },
});
syncBackNavigation();
const realConsoleError = console.error;
console.error = () => {}; // the throw below is deliberate; keep the lane output clean
history.userBack();
console.error = realConsoleError;
const recovered = openLayer("after-throw");
history.userBack();
assert.equal(recovered.closed, 1, "back still works after a close() threw");

// ── 11. Registered component layers sit on top of store layers ──
reset();
const store = openLayer("store-layer");
let registeredClosed = 0;
const unregister = registerBackLayer(() => {
  registeredClosed += 1;
});
assert.deepEqual(
  getBackLayerStack().map((layer) => layer.id.replace(/-\d+$/, "")),
  ["store-layer", "registered"],
  "registered layers are innermost",
);
history.userBack();
assert.equal(registeredClosed, 1, "back closed the registered layer");
assert.equal(store.closed, 0, "the store layer underneath is untouched");
unregister();
history.flush();

// ── 12. Unregistering the last layer consumes the sentinel ──
reset();
const release = registerBackLayer(() => {});
assert.equal(history.depth, 1);
release();
release(); // idempotent
history.flush();
assert.equal(history.depth, 0);

// ── 13. A follow-up layer opened before a cleanup pop re-arms afterward ──
reset();
openLayer("first-modal");
storeLayers = [];
syncBackNavigation(); // queue the cleanup pop
const followUp = openLayer("follow-up-modal");
assert.equal(history.pushes, 1, "an in-flight cleanup must not consume a newly pushed sentinel");
history.flush();
assert.equal(history.depth, 1, "the follow-up layer is armed after cleanup finishes");
history.userBack();
assert.equal(followUp.closed, 1, "back closes the follow-up layer instead of exiting");

// ── 14. Quick presses, one after another, close one layer each and never leave ──
reset();
const outer = openLayer("page");
const middle = openLayer("sheet");
const inner = openLayer("sheet-page");
history.userBack();
history.userBack();
assert.equal(inner.closed, 1);
assert.equal(middle.closed, 1);
assert.equal(outer.closed, 0, "the second press closed only the second layer");
assert.equal(history.depth, 1, "the last layer still has its entry");
history.userBack();
assert.equal(outer.closed, 1);
assert.equal(history.depth, 0);
assert.equal(history.pushes, 3, "entries were only pushed when layers opened");

// ── 15. Forward over our own entry closes nothing ──
reset();
const kept = openLayer("kept");
const gone = openLayer("gone");
history.userBack();
assert.equal(gone.closed, 1);
history.userForward();
assert.equal(kept.closed, 0, "forward is not a back press");
history.flush();
assert.equal(history.depth, 1, "forward is undone so entries match the open layers");

console.log("back-navigation regression checks passed");

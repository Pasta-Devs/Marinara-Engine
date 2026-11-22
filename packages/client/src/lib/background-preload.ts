// ──────────────────────────────────────────────
// Background code fetching, out of the way of taps
//
// The app fetches the code of pages people are likely to open next, so those
// pages never show "Loading…". It used to start everything 1.5-2 s after
// startup on a timer (Safari has no requestIdleCallback), which is exactly when
// people make their first tap: that tap then waited behind ~150 downloads and
// their parsing (QC panel 3, speed H1). Now one queue does it:
//
//   tier 0  what the first tap most likely needs (the chat view, the Library
//           landing page, the last chat's surface). Its downloads start with
//           the first frame, so they are in before the first tap on a phone
//           (the page is still busy drawing Home then, and a tap waits anyway).
//   tier 1  everything else (Library pages, editors, Settings, the omnibar...).
//           Starts once the person's first tap or key has settled (1.5 s with no
//           request loading and no slow frame), or 8 s after startup when
//           nobody touched anything.
//
// One task runs at a time, with a yield to the browser between tasks. A finger
// on the screen pauses the queue, and so does a tap until its own work has
// settled (no request loading, no slow frame for a moment), so a tap waits
// behind at most one task and its readings hold only its own loads. The split view's second side runs tier 0 only.
// Every task leaves performance marks (bg-preload:start:<name> / end) and
// counts in activeBackgroundPreloads(), which Show tap timings reads.
// ──────────────────────────────────────────────
import { requestsInFlight } from "./network-activity";
import { SPLIT_PANE } from "./split-view-env";

export type BackgroundPreloadTier = 0 | 1;

interface Task {
  name: string;
  run: () => Promise<unknown> | unknown;
  tier: BackgroundPreloadTier;
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

/** After the first tap, the queue waits for this long with no request loading and no slow frame. */
const SETTLE_MS = 1500;
/** No tap at all: tier 1 starts this long after startup (still waiting for a quiet moment). */
const NO_INTERACTION_START_MS = 8000;
/** A frame longer than this means the page is still busy. */
const SLOW_FRAME_MS = 50;
/** Never wait for a quiet moment longer than this (a page with an endless animation or a long poll). */
const MAX_SETTLE_WAIT_MS = 10_000;
/** After a tap the queue holds at least this long, so the tap's own work goes first. */
const TAP_PAUSE_MS = 1000;
/** ...and then until the tap's work has been quiet this long (no request loading, no slow frame). */
const TAP_QUIET_MS = 700;
/** A task that hangs (a stalled download) stops holding the queue after this long. */
const TASK_TIMEOUT_MS = 8000;

const queue: Task[] = [];
const known = new Set<string>();
const pending = new Map<string, Task>();
let active = 0;
let installed = false;
let tier0Open = false;
let tier1Open = false;
let pumping = false;
let pointerDown = false;
let pausedUntil = 0;
let interacted = false;
let settleStarted = false;
let resumeTimer = 0;
let tapSettling = false;
let tapSettleRun = 0;
const tier1Waiters: Array<() => void> = [];
/** Name prefixes moved up to tier 0 (prioritizeBackgroundPreloads): tasks queued later with them start there. */
const promotedPrefixes = new Set<string>();

/** How many background preloads are running right now (Show tap timings counts their downloads apart). */
export function activeBackgroundPreloads(): number {
  return active;
}

/** True once tier 1 (everything not needed for the first tap) may run. */
export function backgroundPreloadsSettled(): boolean {
  return tier1Open;
}

function isSplitFrame() {
  return SPLIT_PANE !== null;
}

function idleThen(callback: () => void, timeout = 2000) {
  const idle = (window as IdleWindow).requestIdleCallback;
  if (typeof idle === "function") idle(callback, { timeout });
  else
    requestAnimationFrame(() => {
      window.setTimeout(callback, 50);
    });
}

function paused() {
  return pointerDown || tapSettling || performance.now() < pausedUntil;
}

function onPointerDown(event: PointerEvent) {
  if (!event.isTrusted || !event.isPrimary) return;
  pointerDown = true;
}

function onPointerUp(event: PointerEvent) {
  if (!event.isTrusted || !event.isPrimary) return;
  pointerDown = false;
  noteInteraction();
}

function onKeyDown(event: KeyboardEvent) {
  if (!event.isTrusted) return;
  noteInteraction();
}

function noteInteraction() {
  pausedUntil = performance.now() + TAP_PAUSE_MS;
  if (!interacted) {
    interacted = true;
    waitForQuietThenOpenTier1();
  }
  watchTapSettle();
  scheduleResume();
}

/** Holds the queue until the tap's own work (its requests, its long frames) has gone quiet. */
function watchTapSettle() {
  tapSettling = true;
  const run = ++tapSettleRun;
  const began = performance.now();
  let quietSince = began;
  let last = began;
  const tick = (now: number) => {
    if (run !== tapSettleRun) return;
    if (now - last > SLOW_FRAME_MS || requestsInFlight() > 0 || pointerDown) quietSince = now;
    last = now;
    if (now - quietSince >= TAP_QUIET_MS || now - began >= MAX_SETTLE_WAIT_MS) {
      tapSettling = false;
      scheduleResume();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function scheduleResume() {
  window.clearTimeout(resumeTimer);
  resumeTimer = window.setTimeout(
    () => {
      if (paused()) scheduleResume();
      else pump();
    },
    Math.max(50, pausedUntil - performance.now() + 20),
  );
}

/** Opens tier 1 once the page has been quiet (no request loading, no slow frame) for SETTLE_MS. */
function waitForQuietThenOpenTier1() {
  if (settleStarted || tier1Open) return;
  settleStarted = true;
  const began = performance.now();
  let quietSince = began;
  let last = began;
  const tick = (now: number) => {
    if (tier1Open) return;
    if (now - last > SLOW_FRAME_MS || requestsInFlight() > 0 || paused()) quietSince = now;
    last = now;
    if (now - quietSince >= SETTLE_MS || now - began >= MAX_SETTLE_WAIT_MS) {
      openTier1();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function openTier1() {
  if (tier1Open) return;
  tier1Open = true;
  for (const waiter of tier1Waiters.splice(0)) waiter();
  pump();
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  window.addEventListener("pointerup", onPointerUp, { capture: true, passive: true });
  window.addEventListener("pointercancel", onPointerUp, { capture: true, passive: true });
  window.addEventListener("keydown", onKeyDown, { capture: true, passive: true });
  // Tier 0 with the first frame: started then, its downloads run while the page finishes drawing (it is busy
  // for a while after the first paint on a phone, and a tap waits for that anyway), so they are in before the
  // first tap is handled instead of landing inside it.
  // A tap that came even sooner goes first: then tier 0 waits for it to settle like everything else.
  requestAnimationFrame(() => {
    tier0Open = true;
    pump(!interacted && !paused());
  });
  window.setTimeout(() => {
    if (!interacted) waitForQuietThenOpenTier1();
  }, NO_INTERACTION_START_MS);
}

function nextTier0(): Task | undefined {
  const index = queue.findIndex((task) => task.tier === 0);
  if (index < 0) return undefined;
  const [task] = queue.splice(index, 1);
  return task;
}

function nextTask(): Task | undefined {
  const index = queue.findIndex((task) => (task.tier === 0 ? tier0Open : tier1Open));
  if (index < 0) return undefined;
  const [task] = queue.splice(index, 1);
  return task;
}

function mark(name: string) {
  try {
    performance.mark(name);
  } catch {
    /* marks are best effort */
  }
}

async function runTask(task: Task) {
  pending.delete(task.name);
  active += 1;
  mark(`bg-preload:start:${task.name}`);
  try {
    let timer = 0;
    await Promise.race([
      Promise.resolve()
        .then(task.run)
        .catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, TASK_TIMEOUT_MS);
      }),
    ]);
    window.clearTimeout(timer);
  } finally {
    active -= 1;
    mark(`bg-preload:end:${task.name}`);
  }
}

/** Runs queued tasks one at a time. `tier0Burst`: start every queued tier 0 task now, without slices. */
function pump(tier0Burst = false) {
  if (tier0Burst) {
    for (let task = nextTier0(); task; task = nextTier0()) void runTask(task);
  }
  if (pumping) return;
  pumping = true;
  const step = () => {
    if (paused()) {
      pumping = false;
      scheduleResume();
      return;
    }
    const task = nextTask();
    if (!task) {
      pumping = false;
      return;
    }
    void runTask(task).then(() => idleThen(step));
  };
  idleThen(step);
}

function enqueue(task: Task) {
  // Tier 0 goes before every tier 1 task; within a tier, first come first served.
  const insertAt = task.tier === 0 ? queue.findIndex((item) => item.tier === 1) : -1;
  if (insertAt >= 0) queue.splice(insertAt, 0, task);
  else queue.push(task);
}

/**
 * Queues a background preload. `name` makes it run once per session (later calls with the same name do
 * nothing). A failed task is not retried here: the real open loads the code and reports real failures.
 */
export function scheduleBackgroundPreload(
  name: string,
  run: () => Promise<unknown> | unknown,
  tier: BackgroundPreloadTier = 1,
): void {
  if (typeof window === "undefined") return;
  if (known.has(name)) {
    // Asked for again as "likely first tap": a task still waiting in tier 1 moves up to tier 0.
    const waiting = pending.get(name);
    if (tier === 0 && waiting && waiting.tier === 1) {
      queue.splice(queue.indexOf(waiting), 1);
      waiting.tier = 0;
      enqueue(waiting);
      if (tier0Open) pump(!interacted && !paused());
    }
    return;
  }
  // The split view's second side is a second copy of the app: it fetches only what its own page needs.
  if (tier === 1 && isSplitFrame()) return;
  known.add(name);
  if (tier === 1 && [...promotedPrefixes].some((prefix) => name.startsWith(prefix))) tier = 0;
  const task: Task = { name, run, tier };
  pending.set(name, task);
  enqueue(task);
  install();
  if (tier0Open) pump(tier === 0 && !interacted && !paused());
}

/**
 * The person went where these are needed (the Library opened): queued tasks whose names start with one of
 * `prefixes` move up to tier 0, so they load one per slice as soon as the current tap has settled instead of
 * waiting for tier 1 (QC Nov 14 #2: Library > Characters > a card never shows "Loading…").
 */
export function prioritizeBackgroundPreloads(prefixes: string[]): void {
  for (const prefix of prefixes) promotedPrefixes.add(prefix);
  const picked: Task[] = [];
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const task = queue[index]!;
    if (task.tier === 1 && prefixes.some((prefix) => task.name.startsWith(prefix))) {
      picked.unshift(task);
      queue.splice(index, 1);
    }
  }
  if (!picked.length) return;
  for (const task of picked) {
    task.tier = 0;
    enqueue(task);
  }
  if (tier0Open) pump();
}

/** Runs a queued task now instead of waiting its turn (the first ⌘K, a pointer reaching a chat). */
export function runBackgroundPreloadNow(name: string): void {
  const task = pending.get(name);
  if (!task) return;
  const index = queue.indexOf(task);
  if (index >= 0) queue.splice(index, 1);
  void runTask(task);
}

/** Resolves once tier 1 has opened (for work that should wait the same way without being a code fetch). */
export function afterBackgroundPreloadsSettle(): Promise<void> {
  install();
  if (tier1Open) return Promise.resolve();
  return new Promise((resolve) => tier1Waiters.push(resolve));
}

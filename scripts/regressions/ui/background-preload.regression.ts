/**
 * Background preloads stay out of the first tap (QC panel 3, speed H1): tier 0 starts with the first frame, tier 1
 * waits for the first tap to settle, a finger on the screen holds the queue, and the Library opening moves its
 * pages up. Safari has no requestIdleCallback, which used to fire every preload on a timer right when people tap.
 */
import assert from "node:assert/strict";

type Listener = (event: { isTrusted: boolean; isPrimary?: boolean }) => void;
const listeners = new Map<string, Listener[]>();
const win = {
  addEventListener: (type: string, listener: Listener) =>
    listeners.set(type, [...(listeners.get(type) ?? []), listener]),
  removeEventListener: () => {},
  setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id: number) => clearTimeout(id),
};
Object.assign(globalThis, {
  window: win,
  requestAnimationFrame: (fn: (now: number) => void) => setTimeout(() => fn(performance.now()), 16),
});
const fire = (type: string) => {
  for (const listener of listeners.get(type) ?? []) listener({ isTrusted: true, isPrimary: true });
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const { scheduleBackgroundPreload, prioritizeBackgroundPreloads, activeBackgroundPreloads, backgroundPreloadsSettled } =
  await import("../../../packages/client/src/lib/background-preload.js");

const ran: string[] = [];
const task = (name: string) => async () => {
  ran.push(name);
  await sleep(5);
};
scheduleBackgroundPreload("editor:a", task("editor:a"));
scheduleBackgroundPreload("omnibar", task("omnibar"));
scheduleBackgroundPreload("chat-area", task("chat-area"), 0);
scheduleBackgroundPreload("chat-area", task("chat-area-again"), 0);
await sleep(120);
assert.deepEqual(ran, ["chat-area"], "tier 0 runs with the first frame, once; tier 1 waits");
assert.equal(backgroundPreloadsSettled(), false);

// A finger goes down and stays: nothing new starts.
fire("pointerdown");
scheduleBackgroundPreload("library:landing", task("library:landing"), 0);
await sleep(150);
assert.ok(!ran.includes("library:landing"), "a finger on the screen holds the queue");
fire("pointerup");
// The tap opened the Library: its pages move up to tier 0 and load once the tap has settled.
prioritizeBackgroundPreloads(["library:", "editor:"]);
await sleep(400);
assert.ok(!ran.includes("editor:a"), "nothing starts in the second after a tap");
await sleep(1600);
assert.ok(ran.includes("library:landing") && ran.includes("editor:a"), "promoted tasks run after the tap settles");
assert.ok(ran.indexOf("editor:a") > ran.indexOf("chat-area"));
// Tier 1 opens 1.5 s after the tap went quiet.
await sleep(1200);
assert.equal(backgroundPreloadsSettled(), true);
assert.ok(ran.includes("omnibar"), "tier 1 runs once the first tap has settled");
assert.equal(activeBackgroundPreloads(), 0);
console.log("background-preload regression passed");
process.exit(0);

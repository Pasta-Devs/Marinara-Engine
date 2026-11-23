// Bug sweep Nov 23: keys recorded before Search timed out must not replay later, and one failing
// after-paint callback must not drop the rest of its batch.
import assert from "node:assert/strict";

type Listener = (event: KeyboardEvent) => void;
const listeners = new Set<Listener>();
const timers: Array<() => void> = [];
const fakeWindow = {
  addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
  removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  setTimeout: (callback: () => void) => timers.push(callback),
  clearTimeout: () => {},
};
Object.assign(globalThis, { window: fakeWindow, document: { activeElement: null }, HTMLInputElement: class {} });

const { startOmnibarKeyBuffer, takeOmnibarKeyBuffer } =
  await import("../../../packages/client/src/lib/omnibar-key-buffer.js");

const press = (key: string, extra: Partial<KeyboardEvent> = {}) => {
  const event = { key, preventDefault() {}, stopPropagation() {}, ...extra } as KeyboardEvent;
  for (const listener of [...listeners]) listener(event);
};

startOmnibarKeyBuffer();
press("w");
press("r");
assert.equal(listeners.size, 1);
timers.shift()!(); // the 8 s limit
assert.equal(listeners.size, 0, "stops listening on timeout");
assert.deepEqual(takeOmnibarKeyBuffer(), [], "stale keys are dropped on timeout");

startOmnibarKeyBuffer();
press("a", { keyCode: 229 } as Partial<KeyboardEvent>);
press("b");
assert.deepEqual(takeOmnibarKeyBuffer(), [{ kind: "text", value: "b" }], "IME keys (229) are not recorded");

// idle-batch: a throwing callback does not stop the others.
let rafCallback: (() => void) | null = null;
const errors: unknown[] = [];
Object.assign(globalThis, {
  requestAnimationFrame: (callback: () => void) => {
    rafCallback = callback;
    return 1;
  },
  queueMicrotask: (callback: () => void) => {
    try {
      callback();
    } catch (error) {
      errors.push(error);
    }
  },
});
Object.assign(fakeWindow, { requestIdleCallback: (callback: () => void) => callback() });
const { onNextIdle } = await import("../../../packages/client/src/lib/idle-batch.js");
const ran: string[] = [];
onNextIdle(() => ran.push("first"));
onNextIdle(() => {
  throw new Error("boom");
});
onNextIdle(() => ran.push("third"));
(rafCallback as unknown as () => void)();
assert.deepEqual(ran, ["first", "third"]);
assert.equal(errors.length, 1, "the error is still reported");

console.log("omnibar key buffer timeout + idle batch: ok");

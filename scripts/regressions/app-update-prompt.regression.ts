import assert from "node:assert/strict";
import { runAppUpdateRefresh } from "../../packages/client/src/lib/app-update-prompt.js";

const storage = new Map<string, string>();
const session = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
};
Object.assign(globalThis, {
  sessionStorage: session,
  window: {
    location: { href: "https://app.test/" },
    setTimeout,
    clearTimeout,
  },
});

const immediateWait = async () => undefined;
const runCase = async (refresh: () => void | Promise<void>, suffix: string) => {
  (window.location as { href: string }).href = `https://app.test/${suffix}`;
  let fallbackCount = 0;
  await runAppUpdateRefresh(refresh, {
    operationTimeoutMs: 0,
    activationDelayMs: 0,
    wait: immediateWait,
    fallback: () => {
      fallbackCount += 1;
    },
  });
  return fallbackCount;
};

assert.equal(await runCase(() => undefined, "noop"), 1, "a resolving no-op falls back to one reload");
assert.equal(await runCase(() => undefined, "noop"), 1, "a later explicit retry on the same URL remains allowed");
assert.equal(await runCase(() => Promise.reject(new Error("rejected")), "reject"), 1, "a rejected update falls back");
assert.equal(await runCase(() => new Promise<void>(() => undefined), "pending"), 1, "a pending update times out once");

let calls = 0;
let fallbacks = 0;
(window.location as { href: string }).href = "https://app.test/singleflight";
const pending = runAppUpdateRefresh(
  () => {
    calls += 1;
    return new Promise<void>(() => undefined);
  },
  { operationTimeoutMs: 20, activationDelayMs: 0, wait: immediateWait, fallback: () => (fallbacks += 1) },
);
const duplicate = runAppUpdateRefresh(
  () => {
    calls += 1;
  },
  { operationTimeoutMs: 20, activationDelayMs: 0, wait: immediateWait, fallback: () => (fallbacks += 1) },
);
await Promise.all([pending, duplicate]);
assert.equal(calls, 1, "single-flight invokes the update callback once");
assert.equal(fallbacks, 1, "single-flight performs one fallback");

console.info("App update prompt regression passed: no-op, reject, pending timeout, and repeated-click single-flight.");

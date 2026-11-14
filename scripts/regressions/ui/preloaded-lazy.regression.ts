/**
 * preloadedLazy fetches a component's code once: repeated and overlapping preloads (idle preloading,
 * hover, the open itself) share one load and get the same component, and a failed load can be tried again.
 */
import assert from "node:assert/strict";
import type { ComponentType } from "react";
import { preloadedLazy } from "../../../packages/client/src/lib/preloaded-lazy.js";

const Page: ComponentType<object> = () => null;

let loads = 0;
const once = preloadedLazy(async () => {
  loads += 1;
  return Page;
});
const [a, b] = await Promise.all([once.preload(), once.preload()]);
await once.preload();
assert.equal(loads, 1, "overlapping and repeated preloads share one load");
assert.equal(a, Page);
assert.equal(b, Page);

let attempts = 0;
const flaky = preloadedLazy(async () => {
  attempts += 1;
  if (attempts === 1) throw new Error("offline");
  return Page;
});
await assert.rejects(flaky.preload(), /offline/);
assert.equal(await flaky.preload(), Page, "a failed load is tried again");
assert.equal(attempts, 2);

console.log("preloaded lazy regression passed");

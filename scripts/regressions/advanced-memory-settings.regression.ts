import assert from "node:assert/strict";
import { shouldOpenAdvancedMemorySettings } from "../../packages/client/src/lib/advanced-memory-settings.ts";

const job = (status: "running" | "needs_confirmation" | "error" | "ready", blocking = true) => ({
  status,
  blocking,
});

assert.equal(shouldOpenAdvancedMemorySettings(job("running")), false);
assert.equal(shouldOpenAdvancedMemorySettings(job("ready")), false);
assert.equal(shouldOpenAdvancedMemorySettings(job("needs_confirmation")), true);
assert.equal(shouldOpenAdvancedMemorySettings(job("error")), true);
assert.equal(shouldOpenAdvancedMemorySettings(job("error", false)), false);

console.log("Advanced Memory settings-opening regression passed.");

import assert from "node:assert/strict";
import { createRequire, syncBuiltinESMExports } from "node:module";

process.env.LOG_LEVEL = "silent";

// Count vm.createContext calls made after the module is loaded. The prompt regex
// guard used to build a fresh V8 context for every (message x script) pair.
const require = createRequire(import.meta.url);
const vmCjs = require("node:vm") as typeof import("node:vm");
const originalCreateContext = vmCjs.createContext;
let createContextCalls = 0;
vmCjs.createContext = ((...args: Parameters<typeof originalCreateContext>) => {
  createContextCalls += 1;
  return originalCreateContext(...args);
}) as typeof originalCreateContext;
syncBuiltinESMExports();

const { createTimeoutRegexReplaceGuard, createTimeoutRegexExecutor } = await import(
  "../../packages/server/src/services/lorebook/regex-timeout.js"
);
// Generous timeouts for the positive checks so a loaded machine cannot cause a spurious timeout.
const vmRegexReplaceGuard = createTimeoutRegexReplaceGuard(10_000);
const vmRegexExecutor = createTimeoutRegexExecutor(10_000);

const baseline = createContextCalls;
const longText = "hello world ".repeat(100);

// 1. Many guard and executor calls reuse one context instead of creating one each.
for (let i = 0; i < 50; i += 1) {
  assert.equal(vmRegexReplaceGuard(/world/g, longText), true);
  assert.equal(vmRegexExecutor(/hello/i, longText), true);
  assert.equal(vmRegexExecutor(/absent/i, longText), false);
}
assert.equal(createContextCalls - baseline, 0, "guard and executor calls do not create a new vm context per call");

// 2. The timeout still works in the reused context, and the context is usable afterwards.
const strictGuard = createTimeoutRegexReplaceGuard(20);
const strictExec = createTimeoutRegexExecutor(20);
const evil = /^(a+)+$/;
const evilText = "a".repeat(40) + "b";
assert.equal(strictGuard(evil, evilText), false, "catastrophic replace is aborted by the timeout");
assert.equal(strictExec(evil, evilText), false, "catastrophic test is aborted by the timeout");
assert.equal(vmRegexReplaceGuard(/b$/, evilText), true, "shared context still works after a timeout");
assert.equal(vmRegexExecutor(/b$/, evilText), true, "shared context still works after a timeout");

// 3. No state leaks between calls: global/sticky lastIndex does not carry over.
const sticky = /a/g;
assert.equal(vmRegexExecutor(sticky, "a"), true);
assert.equal(vmRegexExecutor(sticky, "a"), true, "a global regex matches again on the next call");
assert.equal(createContextCalls - baseline, 0, "factories and timeouts do not create contexts either");

vmCjs.createContext = originalCreateContext;
syncBuiltinESMExports();
console.log("server-hunt-b48 regression passed");

import assert from "node:assert/strict";

// Best-effort helpers: a deliberately swallowed failure is logged (rate limited per event, chat and stage) and the
// caller keeps going with a fallback instead of a thrown error or a silent empty catch.
process.env.LOG_LEVEL = "silent";
const { bestEffort, logSuppressed, orFallback, suppressedLogLine } =
  await import("../../packages/server/src/lib/best-effort.js");
const { takeRateLimitedSlot, resetRateLimitedLogs } = await import("../../packages/server/src/lib/log-rate-limit.js");

resetRateLimitedLogs();
assert.doesNotThrow(() =>
  logSuppressed(new Error("cleanup failed"), { event: "regression.cleanup", chatId: "chat-1" }),
);
// The first line for this key was written, so the same key is now inside its window.
assert.equal(takeRateLimitedSlot("regression.cleanup:chat-1:"), null, "one line a minute per event, chat and stage");
assert.equal(takeRateLimitedSlot("regression.cleanup:chat-2:"), 0, "another chat has its own key");
assert.doesNotThrow(() => logSuppressed("not an Error", { event: "regression.cleanup", level: "debug" }));

// Caller fields cannot overwrite the diagnostic fields of the line.
const failure = new Error("real failure");
const line = suppressedLogLine(failure, {
  event: "regression.fields",
  outcome: "ok",
  suppressed: false,
  err: "caller value",
  level: "debug",
});
assert.equal(line.err, failure, "err is the swallowed error");
assert.equal(line.outcome, "failed");
assert.equal(line.suppressed, true);
assert.equal(line.event, "regression.fields");
assert.equal("level" in line, false, "level only picks the log method");

assert.equal(
  await orFallback(Promise.reject(new Error("read failed")), "fallback", { event: "regression.read" }),
  "fallback",
);
assert.equal(await orFallback(Promise.resolve("value"), "fallback", { event: "regression.read" }), "value");

assert.equal(
  await bestEffort({ event: "regression.work" }, async () => {
    throw new Error("work failed");
  }),
  undefined,
);
assert.equal(await bestEffort({ event: "regression.work" }, async () => 42), 42);

console.log("best-effort regression passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Boot steps are timed and a failure names the step it came from.
const { startup } = await import("../../packages/server/src/lib/startup-timeline.js");
const { logger } = await import("../../packages/server/src/lib/logger.js");

assert.match(String(logger.bindings().bootId), /^[0-9a-f]{8}$/u, "each process start has a short boot id");

assert.equal(await startup.phase("sample.ok", () => 42), 42, "a phase returns its step's value");
const failure = new Error("seed exploded");
await assert.rejects(
  startup.phase("sample.outer", () => startup.phase("sample.inner", () => Promise.reject(failure))),
  (error) => error === failure,
  "a failing phase rethrows the original error",
);
assert.equal(startup.stageOf(failure), "sample.inner", "the innermost phase names the failure");
const recorded = startup.phases().map((phase) => `${phase.stage}:${phase.outcome}`);
assert.deepEqual(recorded, ["sample.ok:ok", "sample.inner:failed", "sample.outer:failed"]);

// A slow inner step is reported once: the outer phase's own time excludes it.
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
await startup.phase("nested.outer", async () => {
  await startup.phase("nested.inner", () => wait(120));
});
const inner = startup.phases().find((phase) => phase.stage === "nested.inner")!;
const outer = startup.phases().find((phase) => phase.stage === "nested.outer")!;
assert.ok(inner.selfMs >= 100, "the inner step owns its time");
assert.ok(outer.elapsedMs >= inner.elapsedMs, "the outer phase still reports its wall time");
assert.ok(outer.selfMs < 60, `the outer phase does not count the inner step again (selfMs=${outer.selfMs})`);

const summary = startup.summary();
assert.equal(summary.event, "startup.ready");
assert.equal(summary.phaseCount, 5);
assert.equal(summary.slowest[0]?.stage, "nested.inner", "the summary ranks steps by their own time");

// index.ts wires the timeline and keeps the lines other regressions and launchers wait for.
const index = readFileSync(new URL("../../packages/server/src/index.ts", import.meta.url), "utf8");
assert.match(index, /startup\.phase\("app\.build"/u);
assert.match(index, /Marinara Engine server listening on/u);
assert.match(index, /logger\.info\(ready, "\[startup\] Ready in %d ms"/u);
assert.match(index, /startup\.stageOf\(err\)/u, "a bootstrap failure names its step");

console.info("Logging startup timeline regression passed");

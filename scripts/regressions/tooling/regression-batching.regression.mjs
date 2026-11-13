// scripts/run-regressions.mjs runs batchable files together in one process, and a batch can only save time: a file
// passes there only if it would pass alone, and anything else runs alone. Fixtures: fixtures/regression-batch/.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  batchable,
  BATCHED_REGRESSION_PREFIXES,
  discoverRegressions,
  queueItems,
  runBatch,
} from "../../run-regressions.mjs";

const fixture = (name) => `scripts/regressions/fixtures/regression-batch/${name}.mjs`;
const short = { timeoutMs: () => 3_000, idleMs: 3_000 };
const run = async (...names) => {
  const files = names.map(fixture);
  const { passed, alone } = await runBatch(files, true, short);
  return { passed: passed.map(({ file }) => file), alone };
};

test("passing files pass together, each with its own output", async () => {
  const names = ["passes", "no-final-newline", "checks-env"];
  const { passed, alone } = await runBatch(names.map(fixture), true, short);
  assert.deepEqual(
    passed.map(({ file }) => file),
    names.map(fixture),
  );
  assert.deepEqual(alone, []);
  const printed = (index, text) => passed[index].output.some(([, line]) => line.includes(text));
  assert.ok(printed(0, "passes ran") && !printed(2, "passes ran"));
  assert.ok(printed(1, "no-final-newline ran"), "output without a final newline keeps its file and its marker");
});

test("each file gets back the environment and working directory it started with", async () => {
  assert.deepEqual(await run("changes-env", "checks-env"), {
    passed: [fixture("changes-env"), fixture("checks-env")],
    alone: [],
  });
});

test("a file that throws runs alone; the rest still pass", async () => {
  assert.deepEqual(await run("passes", "fails", "checks-env"), {
    passed: [fixture("passes"), fixture("checks-env")],
    alone: [fixture("fails")],
  });
});

test("an exit code or an error after loading sends the whole batch to run alone", async () => {
  // An exit code can't be told apart from one set late by an earlier file; the late ones land while the next file
  // runs, or as the process would end.
  for (const names of [
    ["passes", "sets-exit-code", "checks-env"],
    ["sets-exit-code-late", "passes", "checks-env"],
    ["fails-late", "passes", "checks-env"],
    ["passes", "fails-late"],
  ]) {
    assert.deepEqual(await run(...names), { passed: [], alone: names.map(fixture) }, names.join(", "));
  }
});

test("a file that hangs, or leaves the process running, sends the whole batch to run alone", async () => {
  assert.deepEqual(await run("passes", "hangs", "checks-env"), {
    passed: [],
    alone: [fixture("passes"), fixture("hangs"), fixture("checks-env")],
  });
  assert.deepEqual(await run("passes", "leaves-timer"), {
    passed: [],
    alone: [fixture("passes"), fixture("leaves-timer")],
  });
  // A shared process that stalls while starting, before its first file.
  const stalled = await runBatch([fixture("passes"), fixture("checks-env")], true, {
    ...short,
    batchPath: fixture("stalled-host"),
  });
  assert.deepEqual(stalled, { passed: [], alone: [fixture("passes"), fixture("checks-env")] });
});

test("only listed files without node:test, process.exit, process.exitCode or process.argv are batched", () => {
  const combat = `${BATCHED_REGRESSION_PREFIXES[0]}example.regression.ts`;
  assert.equal(batchable(combat, 'import assert from "node:assert/strict";'), true);
  for (const text of [
    'import { test } from "node:test";',
    "process.exit(1);",
    "main().catch(() => { process.exitCode = 1; });",
    "if (process.argv[2]) run();",
  ]) {
    assert.equal(batchable(combat, text), false, text);
  }
  assert.equal(batchable("scripts/regressions/chat-branches.regression.ts", ""), false);
});

test("batchable files are queued in groups of 20 unless --isolated", () => {
  // queueItems reads each file, so these are real: 45 combat regressions and two that run alone.
  const combat = discoverRegressions()
    .filter((file) => file.startsWith(BATCHED_REGRESSION_PREFIXES[0]))
    .slice(0, 45);
  assert.equal(combat.length, 45);
  const others = [
    "scripts/regressions/regression-timeout-policy.regression.mjs",
    "scripts/regressions/tooling/regression-batching.regression.mjs",
  ];
  const items = queueItems([others[0], ...combat, others[1]], false);
  assert.deepEqual(items, [combat.slice(0, 20), combat.slice(20, 40), combat.slice(40), ...others]);
  assert.deepEqual(queueItems([...combat, ...others], true), [...combat, ...others]);
  assert.deepEqual(queueItems([combat[0], ...others], false), [combat[0], ...others], "one batchable file runs alone");
});

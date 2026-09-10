// Self-check for the task registry. Run: pnpm --filter @marinara-engine/server exec tsx src/services/task-registry.check.ts
import assert from "node:assert/strict";
import {
  abortTask,
  clearTaskHistory,
  enterTaskContext,
  finishTaskStep,
  finishTask,
  isTaskStopRequested,
  listTaskHistory,
  listTasks,
  registerTask,
  resetTaskRegistryForTests,
  requestTaskStop,
  updateTask,
  updateTaskStage,
  upsertTaskStep,
} from "./task-registry.js";

resetTaskRegistryForTests();
assert.deepEqual(listTasks(), []);

// Every root mission can receive a stop request. Immediate work also runs its abort handle.
let aborted = false;
const finish = registerTask({
  id: "a",
  kind: "generation",
  label: "Generating reply",
  chatId: "chat-1",
  startedAt: 100,
  abort: () => {
    aborted = true;
  },
});
registerTask({ id: "b", kind: "transfer", label: "Model", startedAt: 50 });

const listed = listTasks();
assert.equal(listed.length, 2);
assert.deepEqual(
  listed.map((task) => task.id),
  ["b", "a"],
  "oldest first",
);
const [oldest, newest] = listed as [(typeof listed)[number], (typeof listed)[number]];
assert.equal(newest.cancellable, true);
assert.equal(oldest.cancellable, true);
assert.equal(oldest.stopMode, "safe");
assert.equal(newest.stopMode, "immediate");
assert.equal("abort" in oldest, false, "abort handle must not leak over the wire");

// Stop routes to the handle, is idempotent, and marks safe work for boundary checks.
assert.equal(abortTask("a"), true);
assert.equal(aborted, true);
assert.deepEqual(requestTaskStop("b"), { accepted: true, mode: "safe" });
assert.equal(isTaskStopRequested("b"), true);
assert.equal(listTasks().find((task) => task.id === "b")?.state, "stopping");
assert.equal(abortTask("b"), true);
assert.equal(abortTask("missing"), false);

// Progress patches merge; late patches after finish are silently dropped.
updateTask("b", { progress: { current: 5, total: 10 }, phase: "downloading" });
assert.deepEqual(listTasks().find((task) => task.id === "b")?.progress, { current: 5, total: 10 });
assert.equal(listTasks().find((task) => task.id === "b")?.label, "Model", "patch must not clobber other fields");
upsertTaskStep("b", { id: "queued", label: "Queued child", stage: "before", state: "queued" });
assert.equal(listTasks().find((task) => task.id === "b")?.children.length, 0, "stopping missions reject new work");
const progressSnapshot = listTasks().find((task) => task.id === "b")?.progress;
if (progressSnapshot) progressSnapshot.current = 99;
assert.equal(listTasks().find((task) => task.id === "b")?.progress?.current, 5, "snapshots must be immutable");
finishTask("b", "failed");
updateTask("b", { phase: "downloading" });
assert.equal(
  listTasks().some((task) => task.id === "b"),
  false,
);

// The returned finish fn removes its own task, and is safe to call twice.
finish();
finish();
assert.deepEqual(listTasks(), []);
assert.deepEqual(
  listTaskHistory().map(({ id, outcome }) => ({ id, outcome })),
  [
    { id: "a", outcome: "completed" },
    { id: "b", outcome: "failed" },
  ],
  "finished tasks are newest first and retain their outcome",
);
const historySnapshot = listTaskHistory();
historySnapshot[0]!.label = "mutated";
assert.equal(listTaskHistory()[0]?.label, "Generating reply", "history snapshots must be immutable");

// Nested media work must publish ONE row, not one per re-entrant hop (the video fallback and
// generateImage's self-wrap both re-enter runMediaGenerationRequest under a held permit).
const { runMediaGenerationRequest } = await import("./image/image-generation-queue.js");
let seenWhileNested: number[] = [];
await runMediaGenerationRequest({
  connectionKey: "check",
  queue: false,
  label: "Outer media",
  task: async () => {
    seenWhileNested.push(listTasks().length);
    await runMediaGenerationRequest({
      connectionKey: "check",
      queue: false,
      label: "Inner media",
      task: async () => {
        seenWhileNested.push(listTasks().length);
      },
    });
  },
});
assert.deepEqual(seenWhileNested, [1, 1], "re-entrant media hops must not add duplicate task rows");
assert.deepEqual(listTasks(), [], "media task must be removed when the request settles");
assert.equal(listTaskHistory()[0]?.outcome, "completed");

// A failing media task still clears its row.
await assert.rejects(
  runMediaGenerationRequest({
    connectionKey: "check",
    queue: false,
    label: "Doomed media",
    task: async () => {
      throw new Error("boom");
    },
  }),
);
assert.deepEqual(listTasks(), []);
assert.equal(listTaskHistory()[0]?.outcome, "failed");

// An aborted media request is distinct from a provider failure and still clears its row.
const mediaAbort = new AbortController();
mediaAbort.abort();
await assert.rejects(
  runMediaGenerationRequest({
    connectionKey: "check",
    queue: false,
    label: "Stopped media",
    signal: mediaAbort.signal,
    task: async () => undefined,
  }),
);
assert.deepEqual(listTasks(), []);
assert.equal(listTaskHistory()[0]?.outcome, "aborted");

// Deep media work joins its active mission instead of publishing a duplicate root row/history item.
resetTaskRegistryForTests();
registerTask({ id: "turn", kind: "generation", label: "Generating reply" });
enterTaskContext("turn");
await runMediaGenerationRequest({
  connectionKey: "check",
  queue: false,
  label: "Generating image",
  task: async () => undefined,
});
assert.equal(listTasks().length, 1);
assert.equal(listTasks()[0]?.children[0]?.label, "Generating image");
assert.equal(listTasks()[0]?.children[0]?.state, "completed");
assert.deepEqual(listTaskHistory(), []);

// Only the five newest completions are retained.
resetTaskRegistryForTests();
registerTask({
  id: "hierarchy",
  kind: "generation",
  label: "Generating reply",
  stages: { before: "running", reply: "pending", after: "pending" },
});
upsertTaskStep("hierarchy", { id: "memory", label: "Retrieving memory", stage: "before", state: "running" });
finishTaskStep("hierarchy", "memory");
updateTaskStage("hierarchy", "before", "completed");
updateTaskStage("hierarchy", "reply", "running");
const hierarchy = listTasks()[0]!;
assert.equal(hierarchy.children[0]?.state, "completed");
assert.equal(hierarchy.stages?.reply, "running");
hierarchy.children[0]!.label = "mutated";
assert.equal(listTasks()[0]?.children[0]?.label, "Retrieving memory", "child snapshots must be immutable");
upsertTaskStep("hierarchy", { id: "queued", label: "Queued child", state: "queued" });
requestTaskStop("hierarchy");
assert.equal(listTasks()[0]?.children.find((step) => step.id === "queued")?.state, "skipped");
finishTask("hierarchy", "aborted");
assert.equal(listTaskHistory()[0]?.outcome, "aborted", "a completed safe boundary after stop records aborted");
clearTaskHistory();
assert.deepEqual(listTaskHistory(), []);

resetTaskRegistryForTests();
for (let index = 0; index < 7; index += 1) {
  registerTask({ id: `history-${index}`, kind: "transfer", label: `History ${index}` })(
    index === 6 ? "aborted" : "completed",
  );
}
assert.deepEqual(
  listTaskHistory().map(({ id }) => id),
  ["history-6", "history-5", "history-4", "history-3", "history-2"],
);
assert.equal(listTaskHistory()[0]?.outcome, "aborted");

console.log("task-registry self-check passed");

// Self-check for the task registry. Run: pnpm --filter @marinara-engine/server exec tsx src/services/task-registry.check.ts
import assert from "node:assert/strict";
import {
  abortTask,
  finishTask,
  listTaskHistory,
  listTasks,
  registerTask,
  resetTaskRegistryForTests,
  updateTask,
} from "./task-registry.js";

resetTaskRegistryForTests();
assert.deepEqual(listTasks(), []);

// Cancellable only when an abort handle was supplied.
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
assert.equal(oldest.cancellable, false);
assert.equal("abort" in oldest, false, "abort handle must not leak over the wire");

// Abort routes to the handle; non-cancellable and unknown ids report false.
assert.equal(abortTask("a"), true);
assert.equal(aborted, true);
assert.equal(abortTask("b"), false);
assert.equal(abortTask("missing"), false);

// Progress patches merge; late patches after finish are silently dropped.
updateTask("b", { progress: { current: 5, total: 10 }, phase: "downloading" });
assert.deepEqual(listTasks().find((task) => task.id === "b")?.progress, { current: 5, total: 10 });
assert.equal(listTasks().find((task) => task.id === "b")?.label, "Model", "patch must not clobber other fields");
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

// Only the five newest completions are retained.
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

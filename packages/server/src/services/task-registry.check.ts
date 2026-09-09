// Self-check for the task registry. Run: pnpm --filter @marinara-engine/server exec tsx src/services/task-registry.check.ts
import assert from "node:assert/strict";
import {
  abortTask,
  finishTask,
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
finishTask("b");
updateTask("b", { phase: "downloading" });
assert.equal(
  listTasks().some((task) => task.id === "b"),
  false,
);

// The returned finish fn removes its own task, and is safe to call twice.
finish();
finish();
assert.deepEqual(listTasks(), []);

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

console.log("task-registry self-check passed");

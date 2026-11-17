import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { DISCOVERY_TRAILS } from "../../../packages/shared/src/constants/discovery-trails.js";
import {
  THINGS_TO_TRY_BY_ID,
  THINGS_TO_TRY_TASKS,
  finishedTrails,
  isTaskUnlocked,
  pickNextTasks,
  rankTrails,
} from "../../../packages/client/src/lib/things-to-try.js";

// Home "Things to try": every task is real, chains only point backwards, and the widget picks sensibly.
assert.equal(THINGS_TO_TRY_TASKS.length, 125, "125 tasks (X8 and Gm10 were cut)");
assert.equal(THINGS_TO_TRY_BY_ID.size, THINGS_TO_TRY_TASKS.length, "task ids are unique");
assert.ok(!THINGS_TO_TRY_BY_ID.has("X8") && !THINGS_TO_TRY_BY_ID.has("Gm10"), "cut tasks stay cut");

const partOf = new Map<string, string>(DISCOVERY_TRAILS.map((trail) => [trail.id, trail.part]));
for (const task of THINGS_TO_TRY_TASKS) {
  assert.ok(existsSync(`docs/${task.guide}`), `${task.id}: its guide exists (${task.guide})`);
  for (const group of task.after) {
    for (const id of group) {
      const before = THINGS_TO_TRY_BY_ID.get(id);
      assert.ok(before, `${task.id}: builds on a real task (${id})`);
      // Engine tasks never depend on layout-only ones, so the engine part ports to staging alone.
      if (partOf.get(task.trail) === "engine") {
        assert.equal(partOf.get(before.trail), "engine", `${task.id} (engine) builds only on engine tasks, not ${id}`);
      }
    }
  }
}

// No cycles: every task can be reached by doing tasks in some order.
const reachable = new Set<string>();
for (let changed = true; changed;) {
  changed = false;
  for (const task of THINGS_TO_TRY_TASKS) {
    if (!reachable.has(task.id) && isTaskUnlocked(task, reachable)) {
      reachable.add(task.id);
      changed = true;
    }
  }
}
assert.equal(reachable.size, THINGS_TO_TRY_TASKS.length, "every task can be unlocked");

// A brand-new user starts on Core, and only on tasks with nothing before them.
const fresh = pickNextTasks(new Set(), new Set(), rankTrails(null, null));
assert.equal(fresh.length, 3);
assert.equal(fresh[0]?.id, "C1", "connect a provider comes first");
assert.ok(
  fresh.every((task) => task.after.length === 0),
  "nothing locked is offered",
);

// The trail of the mode used most moves up, and a trail just worked on leads.
assert.equal(rankTrails({ conversation: 9, roleplay: 1, game: 0 }, null)[1], "conversation");
assert.equal(rankTrails({ conversation: 0, roleplay: 4, game: 1 }, "gallery")[0], "gallery");

// Skipped and done tasks never show; picks mix trails.
const done = new Set(["C1", "C2", "C3", "P1"]);
const next = pickNextTasks(done, new Set(["C4"]), rankTrails(null, null));
assert.ok(next.every((task) => !done.has(task.id) && task.id !== "C4"));
assert.ok(new Set(next.map((task) => task.trail)).size > 1, "the three picks come from different trails");

// Finishing a trail is every task in it.
const core = THINGS_TO_TRY_TASKS.filter((task) => task.trail === "core").map((task) => task.id);
assert.deepEqual(finishedTrails(new Set(core)), ["core"]);
assert.deepEqual(finishedTrails(new Set(core.slice(1))), []);
console.log("things to try: OK");

import assert from "node:assert/strict";
import { settleAgentConnectionAssignments } from "../../packages/client/src/lib/agent-routing-bulk.ts";

const events: string[] = [];
let releaseDelayed: (() => void) | undefined;
const delayed = new Promise<void>((resolve) => {
  releaseDelayed = resolve;
});

const resultPromise = settleAgentConnectionAssignments([
  {
    name: "Immediate failure",
    apply: async () => {
      events.push("failed-start");
      throw new Error("fixture failure");
    },
  },
  {
    name: "Delayed success",
    apply: async () => {
      events.push("delayed-start");
      await delayed;
      events.push("delayed-done");
    },
  },
]);

await Promise.resolve();
assert.equal(events.includes("delayed-done"), false);
let settled = false;
void resultPromise.then(() => {
  settled = true;
});
await Promise.resolve();
assert.equal(settled, false, "bulk assignment must remain busy until every write settles");

releaseDelayed?.();
const result = await resultPromise;
assert.deepEqual(result.failedNames, ["Immediate failure"]);
assert.deepEqual(events, ["failed-start", "delayed-start", "delayed-done"]);
console.info("Agent routing bulk assignment waits for delayed writes before reporting partial failure.");

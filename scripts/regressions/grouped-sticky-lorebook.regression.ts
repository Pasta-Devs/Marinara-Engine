import assert from "node:assert/strict";
import { createLorebookEntrySchema } from "../../packages/shared/src/schemas/lorebook.schema.js";
import type { LorebookEntry } from "../../packages/shared/src/types/lorebook.js";
import {
  scanForActivatedEntries,
  updateTimingStatesForScan,
} from "../../packages/server/src/services/lorebook/keyword-scanner.js";

const entries = ["first", "second"].map(
  (id) =>
    ({
      ...createLorebookEntrySchema.parse({ lorebookId: "book", name: id, keys: [id], group: "choices", sticky: 2 }),
      id,
      embedding: null,
    }) as LorebookEntry,
);
let active = scanForActivatedEntries([{ role: "user", content: "first" }], entries);
assert.deepEqual(
  active.map((row) => row.entry.id),
  ["first"],
);
let timing = updateTimingStatesForScan(entries, active, undefined, 0);
for (let turn = 1; turn <= 2; turn += 1) {
  active = scanForActivatedEntries([{ role: "user", content: "second" }], entries, {
    timingStates: timing,
    random: () => 0.99,
  });
  assert.deepEqual(
    active.map((row) => row.entry.id),
    ["first"],
    `Sticky entry must survive turn ${turn}`,
  );
  assert.equal(active[0]?.sticky, true);
  timing = updateTimingStatesForScan(entries, active, timing, turn);
}
active = scanForActivatedEntries([{ role: "user", content: "second" }], entries, { timingStates: timing });
assert.deepEqual(
  active.map((row) => row.entry.id),
  ["second"],
  "Normal group selection resumes after expiry",
);

const stickyState = updateTimingStatesForScan(
  entries,
  [{ entry: entries[0]!, matchedKeys: ["first"], activationSources: ["keyword"], injectionOrder: 0 }],
  undefined,
  0,
);
const disabled = [{ ...entries[0]!, enabled: false }, entries[1]!];
assert.deepEqual(
  scanForActivatedEntries([{ role: "user", content: "second" }], disabled, { timingStates: stickyState }).map(
    (row) => row.entry.id,
  ),
  ["second"],
  "Sticky selection must not bypass a disabled entry",
);
console.log("Grouped lorebook sticky lifetime and expiry regressions passed.");

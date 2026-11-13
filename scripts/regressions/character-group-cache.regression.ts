// Optimistic folder edits are shown on top of the server list while pending (useCharacterGroups select).
// A failed edit just stops being pending, so these cases pin what the panel shows at each step.
import assert from "node:assert/strict";
import { applyGroupEdits } from "../../packages/client/src/lib/character-group-cache";

const server = [
  { id: "f1", name: "Old", characterIds: '["a"]' },
  { id: "f2", name: "Other", characterIds: "[]" },
];

assert.deepEqual(
  applyGroupEdits(server, [
    { id: "f1", name: "New" },
    { id: "f1", characterIds: ["a", "b"] },
  ]),
  [
    { id: "f1", name: "New", characterIds: '["a","b"]' },
    { id: "f2", name: "Other", characterIds: "[]" },
  ],
  "a rename and a member move stack in order; members are written as the server's JSON string",
);

// The rename failed (no longer pending) after the member move landed on the server: old name, new members.
const afterMove = [{ ...server[0], characterIds: '["a","b"]' }, server[1]];
assert.deepEqual(applyGroupEdits(afterMove, []), afterMove, "a failed rename leaves the landed member move");

// Two stacked edits of one folder both failed: the panel is back on the server row.
assert.deepEqual(applyGroupEdits(server, []), server, "two failed edits end on the original row");

assert.deepEqual(applyGroupEdits(server, ["f1"]), [server[1]], "a pending delete hides the folder");
assert.equal(server[0].name, "Old", "the server list is not mutated");

console.info("Character group cache regressions passed.");

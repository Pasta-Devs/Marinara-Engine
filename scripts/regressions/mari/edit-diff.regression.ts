// #4919 Professor Mari "Easy Viewer" diff-logic regression. Guards the two pure client utilities
// that power the readable before/after view: the word-level diff must reconstruct both sides
// exactly (so nothing is dropped or duplicated when highlighting), and field-change extraction must
// find real edits (recursing into the nested `data` column) while skipping noise/unchanged keys.
import assert from "node:assert/strict";
import { diffWords, type DiffSegment } from "../../../packages/client/src/lib/word-diff.js";
import { computeFieldChanges, resolveLorebookVectorStatus } from "../../../packages/client/src/lib/mari-edit-diff.js";

const reconstruct = (segments: DiffSegment[], side: "added" | "removed") =>
  segments
    .filter((s) => s.type === "equal" || s.type === side)
    .map((s) => s.value)
    .join("");

// The diff must faithfully reconstruct BOTH the before (equal + removed) and after (equal + added).
for (const [before, after] of [
  ["the quick brown fox", "the slow brown fox jumps"],
  ["", "brand new content"],
  ["only in before", ""],
  ["identical", "identical"],
  ["a b c d e", "a x c y e"],
]) {
  const segments = diffWords(before, after);
  assert.equal(reconstruct(segments, "removed"), before, `before reconstructs for "${before}" -> "${after}"`);
  assert.equal(reconstruct(segments, "added"), after, `after reconstructs for "${before}" -> "${after}"`);
}

// A single changed word yields isolated removed/added segments (tight highlighting), not a blob.
const wordChange = diffWords("the quick brown fox", "the quick red fox");
assert.ok(wordChange.some((s) => s.type === "removed" && s.value.includes("brown")), "removed word is isolated");
assert.ok(wordChange.some((s) => s.type === "added" && s.value.includes("red")), "added word is isolated");
assert.ok(wordChange.some((s) => s.type === "equal" && s.value.includes("fox")), "unchanged text is preserved");

assert.deepEqual(diffWords("same", "same"), [{ type: "equal", value: "same" }], "identical input is one equal segment");
assert.deepEqual(diffWords("", ""), [], "two empty strings diff to nothing");

// computeFieldChanges recurses into a character `data` column and labels the nested field.
const charUpdate = computeFieldChanges({
  table: "characters",
  id: "c1",
  action: "update",
  before: { id: "c1", updatedAt: "t0", data: { name: "Joey", description: "old bio", personality: "warm" } },
  after: { id: "c1", updatedAt: "t1", data: { name: "Joey", description: "new bio", personality: "warm" } },
});
assert.equal(charUpdate.length, 1, "only the changed nested field is reported");
assert.equal(charUpdate[0].label, "Description", "nested data.description gets a friendly label");
assert.equal(charUpdate[0].before, "old bio");
assert.equal(charUpdate[0].after, "new bio");
assert.equal(charUpdate[0].kind, "changed");

// Noise keys (id, updatedAt) never surface as changes even when they differ.
const noiseOnly = computeFieldChanges({
  table: "characters",
  id: "c1",
  action: "update",
  before: { id: "c1", updatedAt: "t0", data: { description: "same" } },
  after: { id: "c1", updatedAt: "t1", data: { description: "same" } },
});
assert.equal(noiseOnly.length, 0, "changing only updatedAt yields no visible field changes");

// A lorebook key-array change is detected and displayed as a comma list.
const keyChange = computeFieldChanges({
  table: "lorebook_entries",
  id: "e1",
  action: "update",
  before: { id: "e1", name: "Map", keys: ["city"] },
  after: { id: "e1", name: "Map", keys: ["city", "sector"] },
});
assert.equal(keyChange.length, 1);
assert.equal(keyChange[0].label, "Primary keys");
assert.equal(keyChange[0].before, "city");
assert.equal(keyChange[0].after, "city, sector");

// Insert (before null) reports non-empty fields as added; empty array fields are not shown.
const inserted = computeFieldChanges({
  table: "lorebook_entries",
  id: "e2",
  action: "insert",
  before: null,
  after: { id: "e2", name: "New entry", content: "body", keys: [] },
});
assert.ok(inserted.length > 0 && inserted.every((c) => c.kind === "added"), "insert fields are all added");
assert.ok(inserted.some((c) => c.label === "Name" && c.after === "New entry"), "insert surfaces the name");
assert.ok(!inserted.some((c) => c.label === "Primary keys"), "an empty array field is not shown as a change");

// Boolean-ish integer fields (memory enabled/persistent, stored as 0/1) render as on/off, not "0"/"1".
const memoryInsert = computeFieldChanges({
  table: "mari_instructions",
  id: "m1",
  action: "insert",
  before: null,
  after: { id: "m1", name: "Prefs", content: "body", enabled: 0, persistent: 1 },
});
assert.ok(memoryInsert.some((c) => c.label === "Enabled" && c.after === "off"), "enabled:0 renders as off");
assert.ok(memoryInsert.some((c) => c.label === "Persistent" && c.after === "on"), "persistent:1 renders as on");

// A lorebook entry setting outside the specialized layout (probability, timing, etc. — all
// editable since #4791) is still surfaced by computeFieldChanges, so the Easy Viewer's catch-all
// renders it instead of silently dropping the change.
const lorebookSetting = computeFieldChanges({
  table: "lorebook_entries",
  id: "e3",
  action: "update",
  before: { id: "e3", name: "Map", probability: 50, sticky: 0 },
  after: { id: "e3", name: "Map", probability: 100, sticky: 3 },
});
assert.ok(
  lorebookSetting.some((c) => c.label === "Probability" && c.before === "50" && c.after === "100"),
  "an unlisted lorebook setting (probability) is surfaced",
);
assert.ok(lorebookSetting.some((c) => c.label === "Sticky" && c.after === "3"), "a timing change is surfaced");

// Easy Viewer must distinguish opt-out, completed embedding, and eligible-but-not-yet-embedded.
// An explicit opt-out wins even if a stale embedding is still present.
const vectorSnapshots = [
  { excludeFromVectorization: false, embedding: [] },
  { excludeFromVectorization: false, embedding: [0.25, 0.5] },
  { excludeFromVectorization: true, embedding: [0.25, 0.5] },
];
assert.deepEqual(
  vectorSnapshots.map(resolveLorebookVectorStatus),
  ["notVectorized", "vectorized", "excluded"],
  "all three lorebook vector states are resolved truthfully",
);
assert.deepEqual(
  [resolveLorebookVectorStatus(vectorSnapshots[0]), resolveLorebookVectorStatus(vectorSnapshots[1])],
  ["notVectorized", "vectorized"],
  "generating an embedding transitions from not vectorized to vectorized",
);
assert.deepEqual(
  [resolveLorebookVectorStatus(vectorSnapshots[1]), resolveLorebookVectorStatus(vectorSnapshots[2])],
  ["vectorized", "excluded"],
  "opting out transitions from vectorized to excluded",
);
assert.deepEqual(
  [resolveLorebookVectorStatus(vectorSnapshots[2]), resolveLorebookVectorStatus(vectorSnapshots[0])],
  ["excluded", "notVectorized"],
  "opting back in without an embedding transitions from excluded to not vectorized",
);

console.log("Mari Easy Viewer diff regressions passed.");

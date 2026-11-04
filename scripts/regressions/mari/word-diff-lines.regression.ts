import { diffLines, diffWordRuns, diffWords } from "../../../packages/client/src/lib/word-diff.js";

// Line diffs for her edit cards (edit-diff.regression.ts covers the word diff).
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const words = diffWords("the quick brown fox", "the quick red fox");
assert(
  words
    .filter((s) => s.type === "removed")
    .map((s) => s.value)
    .join("") === "brown",
  "only the changed word is removed",
);
assert(
  words
    .filter((s) => s.type === "added")
    .map((s) => s.value)
    .join("") === "red",
  "only the changed word is added",
);

// A one-line edit inside a long text must not repaint the whole text.
const before = ["a", "b", "c", "d", "e", "f", "g", "h", "old line", "i", "j", "k", "l", "m"].join("\n");
const after = before.replace("old line", "new line");
const hunks = diffLines(before, after);
const lines = hunks.flatMap((h) => h.lines);
assert(lines.filter((l) => l.type === "removed").length === 1, "exactly one removed line");
assert(lines.filter((l) => l.type === "added").length === 1, "exactly one added line");
assert(hunks[0].skipped === 5, "unchanged lines beyond the context window collapse");
assert(
  lines.every((l) => l.type === "equal" || l.segments),
  "changed lines carry intra-line segments",
);
const removed = lines.find((l) => l.type === "removed")!;
assert(
  removed.segments!.every((s) => s.type !== "added"),
  "a removed line never shows added words",
);

// Unrelated lines are not force-paired into a word diff.
const rewritten = diffLines("alpha", "totally different");
assert(
  rewritten[0].lines.every((l) => !l.segments),
  "dissimilar lines stay whole-line adds/removes",
);

assert(
  diffLines("same", "same")[0].lines.every((l) => l.type === "equal"),
  "identical text is all context",
);

// An empty side is no lines, not one blank line: creating a value must not show a
// phantom blank removal above the new text.
const created = diffLines("", "first\nsecond");
const createdLines = created.flatMap((hunk) => hunk.lines);
assert(createdLines.length === 2, "an empty before contributes no lines");
assert(
  createdLines.every((line) => line.type === "added"),
  "creating a value is all additions",
);
const cleared = diffLines("first\nsecond", "");
assert(
  cleared.flatMap((hunk) => hunk.lines).every((line) => line.type === "removed"),
  "clearing a value is all removals",
);
assert(diffLines("", "").length === 0, "empty to empty has nothing to show");

// A rewritten phrase reads as one edit: the whole old run struck, then the whole new run,
// not old word, new word, old word, new word.
{
  const before = "A brilliant researcher and respected authority in her field, a professional shield.";
  const after = "A brilliant researcher whose outward professionalism has become a shield.";
  const runs = diffWordRuns(before, after);
  assert(
    runs.map((s) => s.type).join(",") === "equal,removed,added,equal",
    `one edited run, old then new (got ${runs.map((s) => s.type).join(",")})`,
  );
  assert(runs[1].value === "and respected authority in her field, a professional", "the old run is whole");
  assert(runs[2].value === "whose outward professionalism has become a", "the new run is whole");
  const spell = (keep: string) =>
    runs
      .filter((s) => s.type === "equal" || s.type === keep)
      .map((s) => s.value)
      .join("");
  assert(spell("removed") === before, "kept + removed still spells the old text");
  assert(spell("added") === after, "kept + added still spells the new text");

  // A longer kept word between two edits stays kept, and so does a line break.
  const apart = diffWordRuns("one cat sleeps quietly here", "two cat sleeps loudly here");
  assert(
    apart.filter((s) => s.type === "equal").some((s) => s.value.includes("cat sleeps")),
    "longer kept words separate two edits",
  );
  const lines = diffWordRuns("old\nold", "new\nnew");
  assert(
    lines.some((s) => s.type === "equal" && s.value === "\n"),
    "edits on either side of a line break stay separate",
  );
}

console.log("word-diff: ok");

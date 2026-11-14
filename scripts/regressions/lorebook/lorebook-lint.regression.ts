import assert from "node:assert/strict";
import { lintLorebookEntries, type LintableLorebookEntry } from "../../../packages/shared/src/utils/lorebook-lint.js";

function entry(id: string, overrides: Partial<LintableLorebookEntry> = {}): LintableLorebookEntry {
  return {
    id,
    name: `Entry ${id}`,
    content: `Unique lore for ${id}.`,
    keys: [`keyword-${id}`],
    enabled: true,
    constant: false,
    useRegex: false,
    caseSensitive: false,
    order: 100,
    ...overrides,
  };
}

const codesFor = (issues: ReturnType<typeof lintLorebookEntries>, id: string) =>
  issues.filter((issue) => issue.entryId === id).map((issue) => issue.code);

// A clean book produces no issues.
assert.deepEqual(lintLorebookEntries([entry("a"), entry("b")]), []);

const issues = lintLorebookEntries(
  [
    entry("empty", { content: "   " }),
    entry("nokeys", { keys: ["", "  "] }),
    entry("constant-nokeys", { keys: [], constant: true }),
    entry("regex-bad", { useRegex: true, keys: ["(unclosed"] }),
    entry("regex-unsafe", { useRegex: true, keys: ["(a+)+$"] }),
    entry("regex-ok", { useRegex: true, keys: ["dragons?"] }),
    entry("dup-a", { keys: ["Valdenmoor", "Castle"] }),
    entry("dup-b", { keys: ["valdenmoor"] }),
    entry("case-a", { keys: ["Rose"], caseSensitive: true }),
    entry("case-b", { keys: ["rose"], caseSensitive: true }),
    entry("same-1", { content: "The   Ember Court rules the south." }),
    entry("same-2", { content: "the ember court rules the SOUTH." }),
    entry("long", { content: "word ".repeat(2000) }),
    entry("off", { enabled: false }),
    entry("short", { keys: ["Al"] }),
    entry("common", { keys: ["The"] }),
    entry("constant-short", { keys: ["x"], constant: true }),
  ],
  { maxEntryTokens: 1000 },
);

assert.deepEqual(codesFor(issues, "empty"), ["empty_content"]);
assert.deepEqual(codesFor(issues, "nokeys"), ["no_keys"]);
assert.deepEqual(codesFor(issues, "constant-nokeys"), [], "constant entries do not need keys");
assert.deepEqual(codesFor(issues, "regex-bad"), ["invalid_regex"]);
assert.equal(issues.find((issue) => issue.entryId === "regex-bad")?.severity, "error");
assert.deepEqual(codesFor(issues, "regex-unsafe"), ["unsafe_regex"]);
assert.deepEqual(codesFor(issues, "regex-ok"), []);

const dupA = issues.find((issue) => issue.entryId === "dup-a" && issue.code === "duplicate_key");
assert.ok(dupA, "case-insensitive keys shared by two entries are duplicates");
assert.deepEqual(dupA.relatedEntryIds, ["dup-b"]);
assert.equal(dupA.severity, "info");
assert.deepEqual(codesFor(issues, "case-a"), [], "case-sensitive keys that differ in case are distinct");

// Duplicate keys mean identical matching modes, not merely overlapping text.
for (const literal of ["Rose", "rose"]) {
  const mixedModes = lintLorebookEntries([
    entry("insensitive", { keys: ["rose"] }),
    entry("sensitive", { keys: [literal], caseSensitive: true }),
    entry("regex", { keys: ["rose"], useRegex: true }),
  ]);
  assert.ok(!mixedModes.some((issue) => issue.code === "duplicate_key"), "different matching modes stay distinct");
}
assert.ok(
  !lintLorebookEntries([
    entry("digits", { keys: ["\\d"], useRegex: true }),
    entry("non-digits", { keys: ["\\D"], useRegex: true }),
  ]).some((issue) => issue.code === "duplicate_key"),
  "regex escape case changes semantics even when matching ignores case",
);

const same1 = issues.find((issue) => issue.entryId === "same-1");
assert.equal(same1?.code, "duplicate_content", "whitespace and case do not hide identical content");
assert.deepEqual(same1?.relatedEntryIds, ["same-2"]);

const long = issues.find((issue) => issue.entryId === "long");
assert.equal(long?.code, "overlong");
assert.ok((long?.tokens ?? 0) > 1000);
assert.deepEqual(codesFor(issues, "off"), ["disabled"]);
assert.deepEqual(codesFor(issues, "short"), ["short_key"]);
assert.deepEqual(codesFor(issues, "common"), ["common_key"]);
assert.deepEqual(codesFor(issues, "constant-short"), [], "constant entries never fire on keys, so short keys are moot");

// Sorted by severity: errors, then warnings, then info.
const ranks = { error: 0, warning: 1, info: 2 } as const;
for (let index = 1; index < issues.length; index++) {
  assert.ok(ranks[issues[index - 1]!.severity] <= ranks[issues[index]!.severity], "issues are sorted by severity");
}

// Threshold is configurable.
assert.equal(
  lintLorebookEntries([entry("mid", { content: "word ".repeat(300) })], { maxEntryTokens: 50 })[0]?.code,
  "overlong",
);

// Large books stay fast (hundreds of entries, a few keys each).
const big = Array.from({ length: 3000 }, (_, index) =>
  entry(`n${index}`, { keys: [`npc ${index}`, `alias ${index}`, index % 50 === 0 ? "Shared" : `tag ${index}`] }),
);
const started = performance.now();
const bigIssues = lintLorebookEntries(big);
assert.ok(performance.now() - started < 2000, "lint of 3000 entries finishes quickly");
assert.equal(bigIssues.filter((issue) => issue.code === "duplicate_key").length, 60);

console.log("lorebook-lint regression passed");

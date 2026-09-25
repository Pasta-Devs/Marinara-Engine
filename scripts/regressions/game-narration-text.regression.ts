import assert from "node:assert/strict";
import {
  stripBalancedTag,
  stripGmTagsKeepReadables,
  stripMapUpdateTag,
  stripUnknownBracketTags,
} from "../../packages/shared/src/utils/game-narration-text.js";

assert.equal(
  stripGmTagsKeepReadables("Before [combat_result]\nprivate recap\n[/combat_result] after"),
  "Before  after",
);
assert.equal(
  stripGmTagsKeepReadables("A [COMBAT_RESULT]one[/COMBAT_RESULT] B [combat_result]two[/combat_result] C"),
  "A  B  C",
);
assert.equal(
  stripGmTagsKeepReadables('Read [note: "Keep me"] and [Book: "Chapter one"] [state: {"hp":2}]'),
  'Read [note: "Keep me"] and [Book: "Chapter one"]',
);
assert.equal(stripUnknownBracketTags('A [unknown: {"quoted": "]", "nested": [1,2]}] B'), "A  B");
assert.equal(stripBalancedTag('A [choices: ["one", "two"]] B [choices: []] C', "[choices:"), "A  B  C");
assert.equal(stripBalancedTag("A [choices: broken [choices: []] B", "[choices:"), "A [choices: broken  B");
assert.equal(stripMapUpdateTag("Before [map_update: broken\nAfter"), "Before After");
assert.equal(stripGmTagsKeepReadables("A [party-turn][party-chat][music: calm] B"), "A  B");

assert.equal(stripBalancedTag('A [choices: ["a ] b", "c"]] Z', "[choices:"), "A  Z");
assert.equal(stripBalancedTag('A [choices: ["a \\" ] b"]] Z', "[choices:"), "A  Z");

// Malformed model output used to rescan the remaining text for every opener.
// This input is small enough to be returned by a model, but quadratic scans stall it.
for (const tag of ["[combat_result]", "[map_update:", "[choices:", "[unknown:"]) {
  const input = tag.repeat(20_000);
  const started = performance.now();
  const result = stripGmTagsKeepReadables(input);
  assert.ok(performance.now() - started < 2_000, `${tag} must be stripped without quadratic rescanning`);
  assert.equal(result, tag === "[map_update:" ? "" : input);
}

console.info("Game narration stripping preserves readables and handles repeated unclosed tags in bounded time.");

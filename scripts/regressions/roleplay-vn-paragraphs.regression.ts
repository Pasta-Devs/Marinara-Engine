import assert from "node:assert/strict";
import {
  latestRoleplayParagraph,
  splitRoleplayParagraphs,
} from "../../packages/client/src/lib/roleplay-vn-paragraphs";

assert.equal(latestRoleplayParagraph(""), "");
assert.equal(latestRoleplayParagraph("First line\nwrapped line.\n\nLast paragraph."), "Last paragraph.");
assert.equal(latestRoleplayParagraph("First paragraph", true), "");
assert.equal(latestRoleplayParagraph("First paragraph\n", true), "");
assert.equal(latestRoleplayParagraph("First paragraph\n\n", true), "First paragraph");
assert.equal(latestRoleplayParagraph("First\n\nUnfinished next", true), "First");
assert.equal(latestRoleplayParagraph("First\n\nSecond\n\nThird", true), "Second");
assert.equal(latestRoleplayParagraph("First\r\n \r\nSecond", true), "First");
assert.equal(latestRoleplayParagraph("First\n\n\n\n"), "First");
assert.equal(latestRoleplayParagraph("First\n\n```text\ncode\n\nmore", true), "First");
assert.equal(latestRoleplayParagraph("First\n\n~~~text\ncode\n\nmore\n~~~\n\n", true), "~~~text\ncode\n\nmore\n~~~");
assert.equal(latestRoleplayParagraph("**Final** paragraph", false), "**Final** paragraph");

// splitRoleplayParagraphs regressions
assert.deepEqual(splitRoleplayParagraphs(""), []);
assert.deepEqual(
  splitRoleplayParagraphs("First paragraph\nwrapped.\n\nSecond paragraph.\n\nThird paragraph."),
  ["First paragraph\nwrapped.", "Second paragraph.", "Third paragraph."],
);
assert.deepEqual(splitRoleplayParagraphs("First\n\nUnfinished", true), ["First"]);
assert.deepEqual(splitRoleplayParagraphs("First\n\nSecond\n\n", true), ["First", "Second"]);
assert.deepEqual(
  splitRoleplayParagraphs("```ts\nconst x = 1;\n\nconst y = 2;\n```\n\nAfter code"),
  ["```ts\nconst x = 1;\n\nconst y = 2;\n```", "After code"],
);
console.log("Roleplay VN paragraph regression passed");


import assert from "node:assert/strict";

// #8030 follow-up: a long game rebuilt every Session Log entry, and compiled every display regex script
// for every message, on each skip, reveal or settings toggle. Past entries are now kept per message and
// each pattern is compiled once, so both caches must still rebuild whenever their inputs change.
const { MessageMemo } = await import("../../packages/client/src/components/game/message-memo.js");
const { compileRegexScriptPattern } = await import("../../packages/client/src/hooks/use-apply-regex.js");

type Msg = { id: string; content: string; extra: Record<string, unknown> };

let builds = 0;
const memo = new MessageMemo<Msg, string>();
const extra = { swipe: 0 };
const pass = (messages: Msg[], inputs: unknown[], perMessage: (message: Msg) => unknown[] = () => []) => {
  memo.begin(inputs);
  const out = messages.map((message) =>
    memo.get(message, perMessage(message), () => {
      builds++;
      return `${String(inputs[0])}:${message.content}`;
    }),
  );
  memo.end();
  return out;
};

const colors = new Map<string, string>();
const first = [
  { id: "a", content: "one", extra },
  { id: "b", content: "two", extra },
];
assert.deepEqual(pass(first, [colors]), ["[object Map]:one", "[object Map]:two"]);
assert.equal(builds, 2);

// Messages arrive as fresh objects on every refetch; equal fields reuse the entry.
pass(
  first.map((message) => ({ ...message })),
  [colors],
);
assert.equal(builds, 2, "a rebuilt but unchanged message is reused");

// Only the changed message is built again.
pass([first[0]!, { ...first[1]!, content: "two, edited" }], [colors]);
assert.equal(builds, 3, "a changed message is built again");

// A new object in a field (a new swipe, a new extra) counts as a change.
pass(
  [
    { ...first[0]!, extra: { swipe: 1 } },
    { ...first[1]!, content: "two, edited" },
  ],
  [colors],
);
assert.equal(builds, 4);

// Any changed input (colors, edit overlays, regex scripts) drops every entry.
pass([first[0]!], [new Map(colors)]);
assert.equal(builds, 5, "a changed input rebuilds");

// Per-message values such as depth: a message whose depth moved is built again.
builds = 0;
const inputs = [colors];
pass(first, inputs, (message) => [message.id === "a" ? 1 : 0]);
assert.equal(builds, 2);
pass(first, inputs, (message) => [message.id === "a" ? 2 : 1]);
assert.equal(builds, 4, "a changed per-message value rebuilds that message");

// Messages that left the pass are forgotten, so a returning one is built again.
builds = 0;
pass(first, inputs);
pass([first[0]!], inputs);
pass(first, inputs);
assert.equal(builds, 3, "an entry for a message that left the pass is dropped");

// Compiled patterns are shared, unsafe or invalid ones are refused, and flags are part of the key.
const bold = compileRegexScriptPattern("\\*\\*(.+?)\\*\\*", "g");
assert.ok(bold);
assert.equal(compileRegexScriptPattern("\\*\\*(.+?)\\*\\*", "g"), bold, "the same pattern compiles once");
assert.notEqual(compileRegexScriptPattern("\\*\\*(.+?)\\*\\*", "gi"), bold, "flags are part of the key");
// A pattern over the safety check's length limit stands in for an unsafe one.
assert.equal(
  compileRegexScriptPattern("a".repeat(1001), "g"),
  null,
  "a pattern the safety check refuses stays refused",
);
assert.equal(compileRegexScriptPattern("(unclosed", "g"), null, "an invalid pattern is refused");

console.log("game session log memo regression passed");

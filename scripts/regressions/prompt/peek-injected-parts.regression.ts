// Peek prompt showed the Author's Note (and World Info @depth entries) as plain "You" text: post-processing
// ("Apply", the default) sends them inside the nearby user message. The saved request now keeps where each
// injected block sits, for Peek only; what is sent stays the same.
import assert from "node:assert/strict";
import { postProcessMessages } from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import {
  labelInjectedParts,
  readPeekPromptParts,
  worldInfoPeekBlocks,
} from "../../../packages/server/src/services/prompt/peek-injected-parts.js";
import { injectAtDepth } from "../../../packages/server/src/services/lorebook/prompt-injector.js";

const note = "[Ilse is hiding a letter.]";
const lore = "The letter is sealed with green wax.";
const history = [
  { role: "system" as const, content: "Main prompt.", contextKind: "prompt" as const },
  { role: "assistant" as const, content: "The marsh is quiet.", contextKind: "history" as const },
  { role: "user" as const, content: "Hello, Ilse.", contextKind: "history" as const },
  { role: "assistant" as const, content: "She looks away.", contextKind: "history" as const },
  { role: "user" as const, content: "What are you hiding?", contextKind: "history" as const },
];
const injected = injectAtDepth(history, [
  { content: note, role: "system", depth: 1 },
  { content: lore, role: "system", depth: 1 },
]);
const blocks = [
  { label: "authorsNote" as const, depth: 1, content: note },
  ...worldInfoPeekBlocks([
    { content: lore, depth: 1 },
    { content: "  ", depth: 2 },
  ]),
];
assert.equal(blocks.length, 2, "empty entries are left out");

// Apply (the default): the note goes into a user message; Peek gets its range there.
const applied = postProcessMessages(injected as never, { strictRoleFormatting: true });
const before = JSON.stringify(applied);
const labelled = labelInjectedParts(applied, blocks);
assert.equal(JSON.stringify(applied), before, "labelling reads the messages and changes nothing");
const holder = labelled.find(({ parts }) => parts.some((part) => part.label === "authorsNote"));
assert.ok(holder, JSON.stringify(applied));
assert.equal(holder!.message.role, "user", "the AI gets it inside a user message");
const notePart = holder!.parts.find((part) => part.label === "authorsNote")!;
assert.equal(holder!.message.content.slice(notePart.start, notePart.end), note);
const lorePart = labelled.flatMap(({ message, parts }) =>
  parts.filter((part) => part.label === "worldInfo").map((part) => message.content.slice(part.start, part.end)),
);
assert.deepEqual(lorePart, [lore]);

// Don't apply: the note stays its own system message, as Peek already shows it.
const kept = postProcessMessages(injected as never, { strictRoleFormatting: false });
const keptLabels = labelInjectedParts(kept, blocks);
const noteMessage = keptLabels.find(({ message }) => message.content === note);
assert.equal(noteMessage?.message.role, "system");
assert.deepEqual(noteMessage?.parts, [], "a block sent on its own needs no label");

// The same words earlier in the chat aren't mistaken for the injected note.
const echoed = labelInjectedParts(
  [
    { role: "user", content: `${note} (I typed this myself)` },
    { role: "assistant", content: "Hm." },
    { role: "user", content: `Tell me.\n\n${note}` },
  ],
  [blocks[0]!],
);
assert.deepEqual(echoed[0]!.parts, []);
assert.equal(echoed[2]!.parts.length, 1);

// Saved parts are read back only when they fit the message.
assert.deepEqual(readPeekPromptParts([{ start: 0, end: 4, label: "authorsNote", depth: 4 }], 10), [
  { start: 0, end: 4, label: "authorsNote", depth: 4 },
]);
assert.deepEqual(readPeekPromptParts([{ start: 0, end: 40, label: "authorsNote", depth: 4 }], 10), []);
assert.deepEqual(readPeekPromptParts([{ start: 0, end: 4, label: "script", depth: 4 }], 10), []);
assert.deepEqual(readPeekPromptParts("nope", 10), []);

console.log("peek injected parts: OK");

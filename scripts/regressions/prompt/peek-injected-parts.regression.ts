// Peek prompt showed the Author's Note (and World Info @depth entries) as plain "You" text: post-processing
// ("Apply", the default) sends them inside the nearby user message. The saved request now keeps where each
// injected block sits, for Peek only; what is sent stays the same.
import assert from "node:assert/strict";
import { postProcessMessages } from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import { resolveDeferredCharacterMacros, resolveMacros } from "../../../packages/shared/src/utils/macro-engine.js";
import {
  labelInjectedParts,
  peekBlocksForResponder,
  readPeekPromptParts,
  worldInfoPeekBlocks,
} from "../../../packages/server/src/services/prompt/peek-injected-parts.js";
import { injectAtDepth } from "../../../packages/server/src/services/lorebook/prompt-injector.js";
import { cloneMacroContextForPreview } from "../../../packages/server/src/services/prompt/macro-context.js";

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

// A later message quoting the note: the copy at the note's depth is the injected one, not the quote.
const quoted = postProcessMessages(
  injectAtDepth(
    [
      ...history,
      { role: "assistant" as const, content: "Nothing.", contextKind: "history" as const },
      { role: "user" as const, content: `Your notes say "${note}" so?`, contextKind: "history" as const },
    ],
    [{ content: note, role: "system", depth: 3 }],
  ) as never,
  { strictRoleFormatting: true },
);
const quotedLabels = labelInjectedParts(quoted, [{ label: "authorsNote", depth: 3, content: note }]);
const quotedHolder = quotedLabels.findIndex(({ parts }) => parts.length > 0);
assert.ok(quotedHolder >= 0 && quotedHolder < quoted.length - 1, "the quote in the last message isn't labelled");
assert.equal(quotedLabels.at(-1)!.parts.length, 0);

// Two copies in one merged message: the one on its own lines is the injected one, not the one in a sentence.
const twice = `I wrote ${note} on the wall.\n\n${note}`;
const twiceLabels = labelInjectedParts(
  [{ role: "user", content: twice }],
  [{ label: "authorsNote", depth: 0, content: note }],
);
assert.equal(twiceLabels[0]!.parts[0]!.start, twice.lastIndexOf(note));

// Prompt shaping collapses 3+ newlines to a blank line; the note is still found after it.
const spaced = "First.\n\n\nSecond.";
const spacedLabels = labelInjectedParts(
  [{ role: "user", content: `Hi.\n\nFirst.\n\nSecond.` }],
  [{ label: "authorsNote", depth: 0, content: spaced }],
);
assert.equal(spacedLabels[0]!.parts.length, 1, "a note with three newlines keeps its heading");
assert.equal(spacedLabels[0]!.parts[0]!.start, "Hi.\n\n".length);

// A copy on its own line inside the user's paragraph loses to the injected copy, which post-processing joins as its
// own paragraph.
const ownLine = `Remember:\n${note}\nok?\n\n${note}`;
const ownLineLabels = labelInjectedParts(
  [{ role: "user", content: ownLine }],
  [{ label: "authorsNote", depth: 0, content: note }],
);
assert.equal(ownLineLabels[0]!.parts[0]!.start, ownLine.lastIndexOf(note));

// Dry run with a preset: the assembler injects World Info @depth itself; once recorded, merged preset World Info
// gets its label.
const presetMerged = labelInjectedParts(
  [
    { role: "system", content: "Main prompt." },
    { role: "user", content: `Hello.\n\n${lore}\n\nWhat now?` },
  ],
  worldInfoPeekBlocks([{ content: lore, depth: 1 }]),
);
assert.deepEqual(
  presetMerged[1]!.parts.map((part) => part.label),
  ["worldInfo"],
);

// Individual group replies: the note keeps {{char}} deferred until each responder's prompt is built. Each responder
// labels its own resolved copy, and the messages sent to the provider carry no Peek metadata.
const macroContext = {
  user: "Mari",
  char: "Ilse",
  characters: ["Ilse", "Bram"],
  variables: {},
  localVariables: {} as Record<string, string>,
};
const deferredNote = resolveMacros("[{{char}} is hiding a letter.]", macroContext, { deferCharacterMacros: "all" });
for (const name of ["Ilse", "Bram"]) {
  const sentNote = resolveDeferredCharacterMacros(deferredNote, { name }, macroContext);
  assert.equal(sentNote, `[${name} is hiding a letter.]`);
  const sent = [
    { role: "system", content: "Main prompt." },
    { role: "user", content: `Hello.\n\n${sentNote}\n\nWhat now?` },
  ];
  const before = JSON.stringify(sent);
  const unresolved = labelInjectedParts(sent, [{ label: "authorsNote", depth: 0, content: deferredNote }]);
  assert.equal(unresolved[1]!.parts.length, 0, "the deferred text alone can't be found");
  const resolved = labelInjectedParts(
    sent,
    peekBlocksForResponder([{ label: "authorsNote", depth: 0, content: deferredNote }], (text) =>
      resolveDeferredCharacterMacros(text, { name }, macroContext),
    ),
  );
  const part = resolved[1]!.parts[0]!;
  assert.equal(sent[1]!.content.slice(part.start, part.end), sentNote, `${name}'s note is labelled`);
  assert.equal(JSON.stringify(sent), before, "provider messages stay as they were");
  assert.ok(!("parts" in resolved[1]!.message), "no Peek metadata on the message itself");
}

// A deferred card field with a variable write: the reply advances the variable once, and Peek labels the sent
// text by resolving its own copy from the variables as they were before the message pass.
{
  const context = { ...macroContext, localVariables: { visits: "1" } as Record<string, string> };
  const profile = { name: "Ilse", description: "visit {{incvar::visits}}{{getvar::visits}}" };
  const deferred = resolveMacros("[{{description}}]", context, { deferCharacterMacros: "all" });
  assert.equal(context.localVariables.visits, "1", "the field waits for the responder");
  const peekContext = cloneMacroContextForPreview(context as never);
  const sentNote = resolveDeferredCharacterMacros(deferred, profile, context);
  assert.equal(sentNote, "[visit 22]");
  const sent = [{ role: "user", content: `Hello.\n\n${sentNote}` }];
  const labels = labelInjectedParts(
    sent,
    peekBlocksForResponder([{ label: "authorsNote", depth: 0, content: deferred }], (text) =>
      resolveDeferredCharacterMacros(text, profile, cloneMacroContextForPreview(peekContext)),
    ),
  );
  assert.equal(context.localVariables.visits, "2", "the variable advances once per reply");
  const part = labels[0]!.parts[0]!;
  assert.equal(sent[0]!.content.slice(part.start, part.end), sentNote, "Peek labels the text that was sent");
}

// Saved parts are read back only when they fit the message.
assert.deepEqual(readPeekPromptParts([{ start: 0, end: 4, label: "authorsNote", depth: 4 }], 10), [
  { start: 0, end: 4, label: "authorsNote", depth: 4 },
]);
assert.deepEqual(readPeekPromptParts([{ start: 0, end: 40, label: "authorsNote", depth: 4 }], 10), []);
assert.deepEqual(readPeekPromptParts([{ start: 0, end: 4, label: "script", depth: 4 }], 10), []);
assert.deepEqual(readPeekPromptParts("nope", 10), []);

console.log("peek injected parts: OK");

// A greeting (or any message) is displayed from the client's own macro context. It
// reads the chat's variables, so `{{relationshipToUser}}` shows the answer the model
// reads. Pinned through the real resolver the message components use.
import assert from "node:assert/strict";
import { createMessageMacroResolver, resolveMessageMacros } from "../../packages/client/src/lib/chat-macros.js";
import { readChatVariables } from "../../packages/client/src/lib/state-editor/chat-variables-editor-source.js";

const persona = { name: "Ana" };
const character = { name: "Raven" };
const display = (
  template: string,
  { variables, chatVariables }: { variables?: Record<string, string>; chatVariables?: Record<string, string> },
) =>
  resolveMessageMacros(template, {
    persona,
    primaryCharacter: character,
    characters: [character],
    userName: persona.name,
    variables,
    chatVariables,
  });

// A chat variable resolves in a greeting.
assert.equal(
  display("Hello, {{relationshipToUser}}.", { chatVariables: { relationshipToUser: "old friend" } }),
  "Hello, old friend.",
  "a chat variable reads in displayed text",
);

// The prompt reads preset variables before chat ones; display does the same.
assert.equal(
  display("{{mood}}", { variables: { mood: "from the preset" }, chatVariables: { mood: "from the chat" } }),
  "from the preset",
  "a preset variable of the same name wins over the chat's",
);

// An unknown name is left as written.
assert.equal(
  display("{{nobodyDefinedThis}}", { chatVariables: { relationshipToUser: "old friend" } }),
  "{{nobodyDefinedThis}}",
  "an unknown {{name}} stays as written",
);

// Conditionals read the chat value.
assert.equal(
  display('{{#if bond == "rival"}}RIVAL{{/if}}{{#if bond == "ally"}}ALLY{{/if}}', { chatVariables: { bond: "rival" } }),
  "RIVAL",
  "{{#if name == x}} reads the chat variable",
);

// {{setvar}} writes into the context's own copy: showing a message never changes
// the chat's variables, and one message's write is not seen by the next.
const chatVariables = { bond: "ally" };
const resolveFirst = createMessageMacroResolver({ chatVariables, userName: "Ana" });
assert.equal(resolveFirst("{{setvar::bond::rival}}{{bond}}"), "rival", "the write is visible within one resolve");
assert.deepEqual(chatVariables, { bond: "ally" }, "the source object is unchanged after {{setvar}}");
assert.equal(
  createMessageMacroResolver({ chatVariables, userName: "Ana" })("{{bond}}"),
  "ally",
  "a later message starts from the chat's value, not another message's write",
);
assert.equal(
  display("{{setvar::x::1}}{{x}}", { chatVariables }) && Object.keys(chatVariables).join(),
  "bond",
  "a new variable written while displaying does not appear in the chat's variables",
);

// A changed variable shows at once: the display context is rebuilt from the current values.
assert.equal(display("{{bond}}", { chatVariables: { bond: "ally" } }), "ally");
assert.equal(display("{{bond}}", { chatVariables: { bond: "friend" } }), "friend", "a saved answer updates the text");

// The components read the values from chat metadata, stored as an object or as JSON.
assert.deepEqual(readChatVariables({ macroVariables: { bond: "ally", n: 3 } }), { bond: "ally" });
assert.deepEqual(readChatVariables(JSON.stringify({ macroVariables: { bond: "ally" } })), { bond: "ally" });
assert.deepEqual(readChatVariables(null), {});

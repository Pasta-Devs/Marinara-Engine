// Text to speech reads a message's macros as the chat shows them: "Hello {{user}}" is spoken "Hello You",
// never "Hello user" (the braces stripped from the raw macro).
import assert from "node:assert/strict";
import { ttsConfigSchema } from "../../../packages/shared/src/types/tts.js";
import { resolveSpokenMessageMacros } from "../../../packages/client/src/lib/chat-macros.js";
import { buildTTSVoiceRequests } from "../../../packages/client/src/lib/tts-dialogue.js";

const characters = new Map([
  ["cat", { name: "pancakecat", description: "A cat." }],
  ["owl", { name: "Owl" }],
]);
const message = (content: string, extra: Record<string, unknown> = {}) => ({
  id: "m1",
  role: "assistant",
  content,
  characterId: "cat",
  activeSwipeIndex: 0,
  ...extra,
});
const spoken = (content: string, options: Partial<Parameters<typeof resolveSpokenMessageMacros>[1]> = {}, extra = {}) =>
  resolveSpokenMessageMacros(message(content, extra), {
    mode: "roleplay",
    characters,
    chatCharacterIds: ["cat", "owl"],
    ...options,
  });

// The reported case: no persona, roleplay shows "You".
assert.equal(spoken("Hello {{user}}, how can I help you today?"), "Hello You, how can I help you today?");
// Conversations fall back to "User", as their display does.
assert.equal(spoken("Hi {{user}}", { mode: "conversation" }), "Hi User");
// The persona's name, {{char}} as the message's own character, chat variables.
assert.equal(
  spoken("{{user}} meets {{char}}. Mood: {{getvar::mood}}", {
    persona: { name: "Alyssa" },
    chatVariables: { mood: "sunny" },
  }),
  "Alyssa meets pancakecat. Mood: sunny",
);
assert.equal(spoken("I am {{char}}", {}, { characterId: "owl" }), "I am Owl");
// A user message keeps the persona it was sent as.
assert.equal(
  spoken(
    "I am {{user}}",
    { persona: { name: "Current" } },
    {
      role: "user",
      characterId: null,
      extra: JSON.stringify({ personaSnapshot: { personaId: "p0", name: "Earlier" } }),
    },
  ),
  "I am Earlier",
);
// Preset choice variables and the same random seed as the display.
assert.equal(spoken("Tone: {{tone}}", { presetVariables: { tone: "gentle" } }), "Tone: gentle");
assert.equal(spoken("{{random::a,b,c,d,e,f}}"), spoken("{{random::a,b,c,d,e,f}}"));
// Text without macros is passed through untouched.
const plain = "No macros *here*.";
assert.equal(spoken(plain), plain);

// The spoken text reaches every reading style: whole message, and quotes only.
const config = ttsConfigSchema.parse({ enabled: true });
const resolved = spoken('*waves* "Hello {{user}}, how can I help you today?"');
const whole = buildTTSVoiceRequests(resolved, config, "pancakecat", "cat").map((request) => request.text);
assert.ok(whole.join(" ").includes("Hello You"), whole.join(" | "));
assert.ok(!/\buser\b/i.test(whole.join(" ")), whole.join(" | "));
const quotesOnly = buildTTSVoiceRequests(resolved, { ...config, dialogueOnly: true }, "pancakecat", "cat").map(
  (request) => request.text,
);
assert.deepEqual(quotesOnly, ["Hello You, how can I help you today?"]);

console.log("tts spoken macros: ok");

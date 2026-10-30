// Adding a card with character questions to a running chat asks them first, then
// offers the greeting. The greeting preview resolves like a displayed message and
// marks the player's answers. Pins the pure parts: the preview text, the answer
// values, and the "may this chat ask" decision.
import assert from "node:assert/strict";
import type { Persona } from "@marinara-engine/shared";
import { resolveGreetingPreview } from "../../packages/client/src/lib/chat-macros.js";
import { mayAskCardQuestions, readCardWithQuestions } from "../../packages/client/src/lib/onboarding-add-card.js";
import {
  HIGHLIGHT_CLASS,
  cardAnswerValues,
  highlightAnswerValues,
} from "../../packages/client/src/lib/onboarding-preview-highlight.js";

const raven = { id: "raven", data: JSON.stringify({ name: "Raven", description: "A crow." }) };
const personas = [{ id: "ana", name: "Ana" }] as unknown as Persona[];
const chat = { characterIds: ["raven"], personaId: "ana", mode: "roleplay", metadata: {} };
const preview = (template: string, chatVariables: Record<string, string>) =>
  resolveGreetingPreview(template, { character: raven, chat, characters: [raven], personas, chatVariables });

// The preview reads the chat's variables, {{user}} from the persona and {{char}} from this card.
assert.equal(
  preview("{{user}}, I am {{char}}: {{bond}}.", { bond: "old friend" }).text,
  "Ana, I am Raven: old friend.",
  "chat variable, persona and card resolve in the preview",
);

// A tag nothing defines (a persona question's tag, say) stays as written.
assert.equal(preview("Hi {{personaAnswer}}", { bond: "ally" }).text, "Hi {{personaAnswer}}");

// Resolved BEFORE the cut: a tag that straddles the cut is whole in the preview.
const filler = "x".repeat(495);
const cutPreview = preview(`${filler}{{bond}}`, { bond: "friend" });
assert.equal(cutPreview.cut, true, "a long greeting is cut");
assert.equal(cutPreview.text.length, 500);
assert.equal(cutPreview.text.endsWith("frien"), true, "the answer is cut, not the tag");
assert.equal(cutPreview.text.includes("{{"), false, "no half tag is left behind");
assert.deepEqual(preview("short {{bond}}", { bond: "ally" }), { text: "short ally", cut: false });

// The answers to mark: the chat's stored values for this card's question names.
const variables = [{ variableName: "bond" }, { variableName: "mood" }, { variableName: "toString" }];
assert.deepEqual(cardAnswerValues(variables, { bond: "old friend", other: "x" }), ["old friend"]);
assert.deepEqual(cardAnswerValues(variables, {}), [], "no stored answers, nothing to mark");
const template = "Hello, {{bond}}.";
assert.deepEqual(
  highlightAnswerValues("Hello, old friend.", cardAnswerValues(variables, { bond: "old friend" }), template),
  [
    { text: "Hello, ", yours: false },
    { text: "old friend", yours: true },
    { text: ".", yours: false },
  ],
  "the answer inside the resolved greeting is marked",
);
assert.equal(typeof HIGHLIGHT_CLASS, "string");

// Only a Roleplay chat that isn't a hosted room asks.
assert.equal(mayAskCardQuestions({ mode: "roleplay", metadata: {} }), true);
assert.equal(mayAskCardQuestions({ mode: "roleplay", metadata: JSON.stringify({}) }), true);
assert.equal(mayAskCardQuestions({ mode: "conversation", metadata: {} }), false);
assert.equal(mayAskCardQuestions({ mode: "game", metadata: {} }), false);
assert.equal(mayAskCardQuestions({ mode: "roleplay", metadata: { multiplayer: { role: "host" } } }), false);
assert.equal(mayAskCardQuestions(null), false);

// A card with no onboarding has no questions.
assert.equal(readCardWithQuestions(raven.data), null);
assert.equal(readCardWithQuestions(null), null);

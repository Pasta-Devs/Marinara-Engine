import assert from "node:assert/strict";
import { buildBeholderUserMessage } from "../../packages/server/src/services/agents/beholder-state.js";

// The extractor was trained on one exact input layout. These assertions pin it:
//   Persona: <name>
//   Current state:
//   {compact json}
//   <blank line>
//   Narration:
//   <prose>

const state = {
  characters: [{ name: "Rissha", species: "angel", body: { chest: { worn: [{ item: "gown", damage: "pristine" }] } } }],
};

const withState = buildBeholderUserMessage(state, "Rissha", "She steps onto the stone.");
assert.equal(
  withState,
  "Persona: Rissha\n" +
    "Current state:\n" +
    '{"self":{"species":"angel","body":{"chest":{"worn":[{"item":"gown","damage":"pristine"}]}}}}\n' +
    "\n" +
    "Narration:\nShe steps onto the stone.",
  "the persona/state/narration layout is byte-exact",
);

// The persona is keyed as `self`; everyone else keeps their name.
const twoCharacters = buildBeholderUserMessage(
  {
    characters: [
      { name: "Rissha", body: { chest: { bare: true } } },
      { name: "Hesperia", body: { right_hand: { holding: { item: "staff", damage: "pristine" } } } },
    ],
  },
  "Rissha",
  "They face each other.",
);
assert.ok(twoCharacters.includes('"self"'), "the persona is mapped to self");
assert.ok(twoCharacters.includes('"Hesperia"'), "other characters keep their names");

// State is compact, never pretty-printed: the training layout has no newlines inside the JSON.
const stateLine = withState.split("\n")[2] ?? "";
assert.ok(!stateLine.includes("\n"), "state serializes onto one line");
assert.ok(!/:\s\s/u.test(stateLine), "state is compact, not indented");

// With nothing tracked yet, the block is omitted entirely rather than sent as {}.
const coldStart = buildBeholderUserMessage({ characters: [] }, "Rissha", "She wakes.");
assert.equal(coldStart, "Persona: Rissha\nNarration:\nShe wakes.");
assert.ok(!coldStart.includes("Current state"), "no empty state block on a cold start");
assert.equal(buildBeholderUserMessage(null, "Rissha", "She wakes."), "Persona: Rissha\nNarration:\nShe wakes.");

// No persona means no persona line — not "Persona: null" or a placeholder name.
const noPersona = buildBeholderUserMessage({ characters: [] }, null, "Someone moves.");
assert.equal(noPersona, "Narration:\nSomeone moves.");

// The narration is passed through verbatim; normalization happens before this call.
const narration = 'She pulls the coat tighter. "We should go," she said quietly.';
assert.ok(buildBeholderUserMessage({ characters: [] }, "Tim", narration).endsWith(`Narration:\n${narration}`));

// An empty narration still produces a well-formed message rather than a bare label.
assert.equal(buildBeholderUserMessage({ characters: [] }, "Tim", ""), "Persona: Tim\nNarration:\n");

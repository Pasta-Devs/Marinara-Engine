// Guards the character editor's per-field Generate / Improve prompts.
//
// The route accepts a field name from the client, so only whitelisted card fields may reach the
// prompt builder. Improve mode must carry the author's existing text; Generate mode (or Improve on
// a blank field) must not. The target field is never repeated as context, and model wrappers like
// code fences are stripped before the text lands in the editor.
import assert from "node:assert/strict";
import {
  buildCharacterFieldPrompt,
  cleanGeneratedFieldText,
  isCharacterGeneratableField,
} from "../../packages/server/src/services/generation/character-field-prompt.js";

// Whitelist.
for (const field of ["description", "personality", "backstory", "appearance", "scenario", "first_mes", "mes_example"]) {
  assert.equal(isCharacterGeneratableField(field), true, field);
}
assert.equal(isCharacterGeneratableField("alternate_greeting"), true);
for (const bad of ["summary", "name", "system_prompt", "__proto__", "", 42, null, undefined]) {
  assert.equal(isCharacterGeneratableField(bad), false, String(bad));
}

const card = {
  name: "Adele Moreau",
  description: "A townhouse owner and businesswoman.",
  personality: "Warm, possessive, sly.",
  appearance: "",
  first_mes: "Adele opens the door with a smile.",
};

// Generate: no existing-text block, target field excluded from context, blank fields skipped.
const generated = buildCharacterFieldPrompt({ field: "appearance", mode: "generate", card, current: "" });
assert.match(generated, /"Appearance" field/);
assert.match(generated, /Name: Adele Moreau/);
assert.match(generated, /Personality: Warm, possessive, sly\./);
assert.doesNotMatch(generated, /Existing Appearance/);
assert.doesNotMatch(generated, /^Appearance:/m, "blank and target fields are not listed as context");
assert.match(generated, /from scratch/);

// Improve: existing text is carried and the author's facts are preserved.
const improved = buildCharacterFieldPrompt({
  field: "description",
  mode: "improve",
  card,
  current: "  Aged 35, blond hair.  ",
});
assert.match(improved, /Existing Description:\nAged 35, blond hair\.$/);
assert.match(improved, /keep every fact/);
assert.doesNotMatch(
  improved,
  /^Description: A townhouse owner/m,
  "the stale draft copy of the target is not duplicated",
);

// Improve on a blank field falls back to Generate.
const blankImprove = buildCharacterFieldPrompt({ field: "scenario", mode: "improve", card, current: "   " });
assert.doesNotMatch(blankImprove, /Existing Scenario/);
assert.match(blankImprove, /from scratch/);

// Alternate greetings see the First Message so they can differ from it.
const greeting = buildCharacterFieldPrompt({ field: "alternate_greeting", mode: "generate", card, current: "" });
assert.match(greeting, /First Message: Adele opens the door with a smile\./);
assert.match(greeting, /different situation/);

// Example dialogue asks for the <START> / {{char}} format.
assert.match(buildCharacterFieldPrompt({ field: "mes_example", mode: "generate", card: {}, current: "" }), /<START>/);
assert.match(
  buildCharacterFieldPrompt({ field: "personality", mode: "generate", card: {}, current: "" }),
  /no other fields filled in yet/,
);

// Output cleanup.
assert.equal(cleanGeneratedFieldText("```text\nTall and willowy.\n```"), "Tall and willowy.");
assert.equal(cleanGeneratedFieldText("```\n<START>\n{{char}}: Hi.\n```"), "<START>\n{{char}}: Hi.");
assert.equal(cleanGeneratedFieldText("  plain text  "), "plain text");
assert.equal(cleanGeneratedFieldText(null), "");

console.log("character-field-generation regression passed");

// The rows Mari's persona and character actions build before saving: a persona row fills its optional fields, and
// character data is mapped to the card's field names without adding fields the action left unset.
import assert from "node:assert/strict";
import {
  buildPersonaCreateRow,
  normalizeCharacterActionData,
} from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const minimalProfessorMariPersona = buildPersonaCreateRow(
  { name: "Minimal helper persona" },
  "persona-minimal",
  "2026-07-13T00:00:00.000Z",
);
assert.equal(minimalProfessorMariPersona.phoneticName, "");
assert.equal(minimalProfessorMariPersona.convoDisplayName, "");
assert.equal(minimalProfessorMariPersona.aboutMe, "");
assert.equal(minimalProfessorMariPersona.convoBehavior, "");
const generatedCharacterData = normalizeCharacterActionData({
  firstMessage: "Welcome to the laboratory.",
  mesExample: "{{char}}: Observe carefully.",
  creatorNotes: "Created for regression coverage.",
  systemPrompt: "Stay in character.",
  postHistoryInstructions: "Remain concise.",
  characterVersion: "1.2.3",
  alternateGreetings: ["You made it."],
  aboutMe: "lab gremlin. ethically flexible. coffee required.",
});
assert.equal(generatedCharacterData.first_mes, "Welcome to the laboratory.");
assert.equal(generatedCharacterData.mes_example, "{{char}}: Observe carefully.");
assert.equal(generatedCharacterData.creator_notes, "Created for regression coverage.");
assert.equal(generatedCharacterData.system_prompt, "Stay in character.");
assert.equal(generatedCharacterData.post_history_instructions, "Remain concise.");
assert.equal(generatedCharacterData.character_version, "1.2.3");
assert.deepEqual(generatedCharacterData.alternate_greetings, ["You made it."]);
assert.equal(
  (generatedCharacterData.extensions as Record<string, unknown>).aboutMe,
  "lab gremlin. ethically flexible. coffee required.",
);
assert.equal(Object.hasOwn(generatedCharacterData, "aboutMe"), false);
assert.equal(Object.hasOwn(generatedCharacterData, "firstMessage"), false);
const partialCharacterUpdateData = normalizeCharacterActionData({ personality: "Quietly analytical." });
assert.deepEqual(
  partialCharacterUpdateData,
  { personality: "Quietly analytical." },
  "Partial character updates must not synthesize undefined fields that deepMerge treats as deletions",
);
const completeProfessorMariPersona = buildPersonaCreateRow(
  {
    name: "Complete helper persona",
    phoneticName: "Professor Mah-ree",
    convoDisplayName: "Prof. Mari",
    aboutMe: "I help people build worlds.",
    convoBehavior: "Speak warmly and precisely.",
  },
  "persona-complete",
  "2026-07-13T00:00:00.000Z",
);
assert.equal(completeProfessorMariPersona.phoneticName, "Professor Mah-ree");
assert.equal(completeProfessorMariPersona.convoDisplayName, "Prof. Mari");
assert.equal(completeProfessorMariPersona.aboutMe, "I help people build worlds.");
assert.deepEqual(completeProfessorMariPersona.convoBehavior, {
  instruction: "Speak warmly and precisely.",
  insertionStrategy: "constant_after",
});

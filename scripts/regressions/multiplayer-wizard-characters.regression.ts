import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const prepared = readFileSync(
  new URL("../../packages/client/src/features/multiplayer/PreparedMultiplayerGameSetup.tsx", import.meta.url),
  "utf8",
);
const wizard = readFileSync(
  new URL("../../packages/client/src/components/game/GameSetupWizard.tsx", import.meta.url),
  "utf8",
);

// Library rows are { id, data } with the card as JSON: handing them to the wizard raw left every name undefined,
// and typing in the character search threw on name.toLowerCase().
assert.match(prepared, /parseCharacterDisplayData\(\{ data: row\.data, comment: row\.comment \}\)/);
assert.match(prepared, /name: display\.name/);
assert.doesNotMatch(prepared, /characters=\{characters as /);

// The wizard's pickers search through the shared CharacterSelect, not their own name filters.
assert.doesNotMatch(wizard, /return c\.name\.toLowerCase\(\)/);
assert.match(wizard, /<CharacterSelect\b/);

console.log("multiplayer-wizard-characters regression passed");

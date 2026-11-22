// Game illustrations load only the library characters the scene names (#9673), and the lookup still picks the
// same character for each name as it did with the whole library loaded.
import assert from "node:assert/strict";
import { selectIllustrationCandidateCharacters } from "../../../packages/server/src/routes/game.routes.js";
import {
  addNameLookupEntry,
  findCharAvatarFuzzy,
} from "../../../packages/server/src/services/game/npc-avatar-utils.js";

const row = (id: string, name: string) => ({ id, data: JSON.stringify({ name }), avatarPath: `${id}.png` });

const library = [
  row("aria", "Aria"),
  row("rook", "Captain Rook"),
  row("twin-a", "Mira"),
  row("twin-b", "Mira"),
  row("seraphine", "Seraphine Vale"),
  row("unrelated-1", "Bartholomew"),
  row("unrelated-2", "Ignatius Thorne"),
  { id: "broken", data: "{not json", avatarPath: null },
  row("nameless", "   "),
  ...Array.from({ length: 2000 }, (_, index) => row(`filler-${index}`, `Filler Person ${index}`)),
];

const requested = ["Aria", "Rook", "Mira", "Lady Seraphine", "Someone Not In The Library"];
const selected = selectIllustrationCandidateCharacters(library, requested).map((character) => character.id);
assert.deepEqual(selected.sort(), ["aria", "rook", "seraphine", "twin-a", "twin-b"]);

// Nothing named, nothing loaded: an illustration without characters reads no pictures at all.
assert.deepEqual(selectIllustrationCandidateCharacters(library, []), []);
assert.deepEqual(selectIllustrationCandidateCharacters(library, ["  "]), []);

// Same answer per name as a lookup built from the whole library, ambiguity included (two "Mira" cards).
const lookupFrom = (rows: typeof library) => {
  const map = new Map<string, string>();
  for (const character of rows) {
    try {
      const name = (JSON.parse(character.data) as { name?: string }).name;
      addNameLookupEntry(map, name?.trim() || undefined, character.id);
    } catch {
      /* skipped like the real loader */
    }
  }
  return map;
};
const fullLookup = lookupFrom(library);
const scopedLookup = lookupFrom(library.filter((character) => selected.includes(character.id)));
for (const name of requested) {
  assert.equal(findCharAvatarFuzzy(name, scopedLookup), findCharAvatarFuzzy(name, fullLookup), name);
}
assert.equal(findCharAvatarFuzzy("Mira", scopedLookup), undefined);
assert.equal(findCharAvatarFuzzy("Rook", scopedLookup), "rook");

import assert from "node:assert/strict";
import {
  findDuplicateCharacters,
  jaccardSimilarity,
  normalizeCharacterName,
} from "../../../packages/shared/src/utils/character-duplicates.js";

assert.equal(normalizeCharacterName("Élodie (copy)"), "elodie");
assert.equal(normalizeCharacterName("Elodie - Copy"), "elodie");
assert.equal(normalizeCharacterName("ELODIE v2"), "elodie");
assert.equal(normalizeCharacterName("Elodie [SFW] 3"), "elodie");
assert.equal(normalizeCharacterName("  Captain   Mira  "), "captain mira");
assert.equal(normalizeCharacterName("Unit 7"), "unit", "counter suffixes are stripped");
assert.equal(normalizeCharacterName("7"), "7", "a name is never stripped to nothing");

assert.equal(jaccardSimilarity(new Set(["a", "b"]), new Set(["a", "b"])), 1);
assert.equal(jaccardSimilarity(new Set(["a"]), new Set(["b"])), 0);
assert.equal(jaccardSimilarity(new Set(), new Set()), 0);

const knightText =
  "Sir Aldric is a weary knight of the northern marches who guards the old bridge at Harrow Ford. " +
  "He speaks slowly, distrusts sorcery, and keeps a pressed flower from his late wife in his gauntlet.";
const reworded =
  knightText.replace("weary", "tired") + " He has recently taken a squire named Pell who follows him everywhere.";

const groups = findDuplicateCharacters([
  { id: "c1", name: "Elodie", description: "A cheerful baker from the valley.", personality: "Kind." },
  { id: "c2", name: "elodie (copy)", description: "Totally different text about a pirate queen.", personality: "" },
  { id: "k1", name: "Aldric", description: knightText, personality: "Stoic, loyal." },
  { id: "k2", name: "Harrow Ford Guard", description: reworded, personality: "Stoic, loyal." },
  { id: "solo", name: "Nobody", description: "An entirely unrelated wandering bard with a lute.", personality: "" },
  { id: "blank1", name: "", description: "", personality: "" },
  { id: "blank2", name: "", description: "", personality: "" },
]);

const nameGroup = groups.find((group) => group.ids.includes("c1"));
assert.ok(nameGroup, "normalized name match groups copies");
assert.deepEqual(nameGroup.ids, ["c1", "c2"]);
assert.equal(nameGroup.nameMatch, true);

const contentGroup = groups.find((group) => group.ids.includes("k1"));
assert.ok(contentGroup, "near-identical descriptions group even with different names");
assert.deepEqual(contentGroup.ids, ["k1", "k2"]);
assert.equal(contentGroup.nameMatch, false);
assert.ok(contentGroup.similarity >= 0.5 && contentGroup.similarity < 1);

assert.ok(!groups.some((group) => group.ids.includes("solo")));
assert.ok(!groups.some((group) => group.ids.includes("blank1")), "empty cards are not duplicates of each other");
assert.equal(groups.length, 2);

// Boilerplate shared by many cards does not make them duplicates.
const boilerplate = "This character card was made for roleplay. Please be respectful and enjoy the story. ".repeat(3);
const many = Array.from({ length: 80 }, (_, index) => ({
  id: `b${index}`,
  name: `Distinct Person ${String.fromCharCode(65 + (index % 26))}${index}`,
  description: `${boilerplate} Unique detail ${index}: ${"lorem ".repeat(index % 5)} favorite number ${index * 7}.`,
  personality: "",
}));
assert.equal(
  findDuplicateCharacters(many, { threshold: 0.95 }).filter((group) => group.similarity > 0).length,
  0,
  "shared template text alone stays below a strict threshold",
);

// Large libraries stay fast.
const library = Array.from({ length: 4000 }, (_, index) => ({
  id: `l${index}`,
  name: `Character ${index} ${"xyz".slice(index % 3)}`,
  description: `Character number ${index} lives in district ${index % 40} and works as trade ${index % 13} with quirk ${index * 31}.`,
  personality: `Mood ${index % 7}.`,
}));
library.push({ ...library[10]!, id: "l10-dupe" });
const started = performance.now();
const libraryGroups = findDuplicateCharacters(library);
assert.ok(performance.now() - started < 5000, "4000 cards are checked quickly");
assert.ok(libraryGroups.some((group) => group.ids.includes("l10") && group.ids.includes("l10-dupe")));

console.log("character-duplicates regression passed");

import assert from "node:assert/strict";
import { matchesAllCardSearchTags, parseCardTagSearchTerms } from "../../packages/shared/src/utils/text-matching.js";
import {
  formatCardLibraryMeta,
  getCardLibrarySummary,
  matchesCardLibrarySearch,
  parseCardLibrarySearchQuery,
} from "../../packages/client/src/lib/card-library-search.js";

const characterLibrarySearchDocument = {
  name: "Il Dottore",
  title: "Modern AU version",
  meta: formatCardLibraryMeta("Pasta Devs", "3.0"),
  summary: getCardLibrarySummary(["A meticulous creator note.", "A Fatui researcher."]),
  creatorNotes: "A hidden character provenance note.",
  tags: ["scientist", "villain"],
  sections: [
    { content: "A Fatui researcher." },
    { content: "Clinical and exacting." },
    { content: "A laboratory in Snezhnaya." },
    { content: "You are late." },
  ],
};

assert.equal(matchesCardLibrarySearch(characterLibrarySearchDocument, parseCardLibrarySearchQuery("pasta devs")), true);
assert.equal(matchesCardLibrarySearch(characterLibrarySearchDocument, parseCardLibrarySearchQuery("snezhnaya")), true);
assert.equal(
  matchesCardLibrarySearch(characterLibrarySearchDocument, parseCardLibrarySearchQuery("character provenance")),
  true,
  "creator notes remain searchable when another summary is displayed",
);
assert.equal(
  matchesCardLibrarySearch(characterLibrarySearchDocument, parseCardLibrarySearchQuery("-tag:villain dottore")),
  false,
);

const personaLibrarySearchDocument = {
  name: "Mari",
  title: "Research partner",
  meta: formatCardLibraryMeta("SpicyMarinara", "2.0"),
  summary: getCardLibrarySummary(["A precise persona card.", "An AI engineer."]),
  creatorNotes: "A hidden persona provenance note.",
  tags: ["engineer"],
  sections: [
    { content: "An AI engineer." },
    { content: "Curious and formidable." },
    { content: "Working beside Dottore." },
    { content: "A shared laboratory history." },
    { content: "White coat and crimson accents." },
  ],
};

assert.equal(
  matchesCardLibrarySearch(personaLibrarySearchDocument, parseCardLibrarySearchQuery("spicymarinara")),
  true,
);
assert.equal(matchesCardLibrarySearch(personaLibrarySearchDocument, parseCardLibrarySearchQuery("formidable")), true);
assert.equal(
  matchesCardLibrarySearch(personaLibrarySearchDocument, parseCardLibrarySearchQuery("persona provenance")),
  true,
  "persona creator notes remain searchable beside an explicit summary",
);
assert.equal(
  matchesCardLibrarySearch(personaLibrarySearchDocument, parseCardLibrarySearchQuery("precise persona card")),
  true,
  "the explicit summary remains searchable too",
);

const taggedDocument = { name: "Il Dottore", tags: ["male", "Genshin", "Modern AU", "fatui, harbinger"] };
for (const query of [
  "male genshin",
  "genshin,male",
  "ＭＡＬＥ Genshin",
  "male，genshin",
  "male ＂Modern AU＂",
  'male "Modern AU"',
  'male "fatui, harbinger"',
]) {
  assert.equal(matchesCardLibrarySearch(taggedDocument, parseCardLibrarySearchQuery(query)), true, query);
}
for (const query of ["male romance", "female genshin", ",,,", "-male genshin", "genshin -tag:male"]) {
  assert.equal(matchesCardLibrarySearch(taggedDocument, parseCardLibrarySearchQuery(query)), false, query);
}
assert.equal(
  matchesCardLibrarySearch({ tags: ["female", "genshin"] }, parseCardLibrarySearchQuery("male genshin")),
  false,
  "AND tags use exact membership, not substrings",
);
assert.equal(matchesCardLibrarySearch(taggedDocument, parseCardLibrarySearchQuery("Il Dottore")), true);
assert.equal(matchesCardLibrarySearch(taggedDocument, parseCardLibrarySearchQuery("modern au")), true);
assert.deepEqual(parseCardTagSearchTerms('male, MALE "Modern AU"'), ["male", "modern au"]);
assert.deepEqual(parseCardTagSearchTerms("male，genshin"), ["male", "genshin"]);
assert.deepEqual(parseCardTagSearchTerms("male ＂Modern AU＂"), ["male", "modern au"]);
assert.equal(matchesAllCardSearchTags(["male"], []), false, "empty terms do not match every card");
assert.equal(matchesAllCardSearchTags([null, 12, "Male"], ["male"]), true);
assert.equal(matchesAllCardSearchTags("male", ["male"]), false);

console.info("Card library search regression checks passed.");

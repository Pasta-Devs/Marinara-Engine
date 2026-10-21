import assert from "node:assert/strict";
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

assert.equal(
  matchesCardLibrarySearch(characterLibrarySearchDocument, parseCardLibrarySearchQuery("pasta devs")),
  true,
);
assert.equal(
  matchesCardLibrarySearch(characterLibrarySearchDocument, parseCardLibrarySearchQuery("snezhnaya")),
  true,
);
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
assert.equal(
  matchesCardLibrarySearch(personaLibrarySearchDocument, parseCardLibrarySearchQuery("formidable")),
  true,
);
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

console.info("Card library search regression checks passed.");

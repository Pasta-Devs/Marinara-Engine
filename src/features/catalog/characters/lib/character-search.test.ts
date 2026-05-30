import { describe, expect, it } from "vitest";
import {
  characterHasAnyExcludedTag,
  characterMatchesSearchTerms,
  countIncludedTagMatches,
  getCharacterTagsFromData,
  parseCharacterSearchQuery,
} from "./character-search";

describe("character search helpers", () => {
  it("extracts negated tag filters and keeps positive text for backend search", () => {
    expect(parseCharacterSearchQuery('winter mage -tag:"slow burn" !#villain')).toEqual({
      text: "winter mage",
      terms: ["winter", "mage"],
      excludedTags: ["slow burn", "villain"],
    });
  });

  it("does not treat ordinary negative words as tag filters", () => {
    expect(parseCharacterSearchQuery("winter -mage !urgent")).toEqual({
      text: "winter -mage !urgent",
      terms: ["winter", "-mage", "!urgent"],
      excludedTags: [],
    });
  });

  it("preserves positive search text casing for backend storage search", () => {
    expect(parseCharacterSearchQuery("Élodie -tag:Mage")).toEqual({
      text: "Élodie",
      terms: ["élodie"],
      excludedTags: ["mage"],
    });
  });

  it("normalizes character tags from loose card data", () => {
    expect(getCharacterTagsFromData({ tags: [" mage ", "", 42, "Winter"] })).toEqual(["mage", "Winter"]);
  });

  it("matches deeper character card fields for local full-record searches", () => {
    expect(
      characterMatchesSearchTerms(
        {
          comment: "library note",
          data: {
            name: "Rina",
            description: "Ice academy rival",
            personality: "Dry humor",
            scenario: "Hidden winter archive",
            alternate_greetings: ["The moon sigil opens the annex."],
            extensions: {
              altDescriptions: [{ label: "Lantern bearer", content: "Carries a silver lantern." }],
            },
            tags: ["Mage"],
          },
        },
        ["winter", "mage", "sigil", "bearer", "lantern"],
      ),
    ).toBe(true);
  });

  it("checks excluded and included tags case-insensitively", () => {
    const data = { tags: ["Mage", "Winter", "Archivist"] };

    expect(characterHasAnyExcludedTag(data, ["winter"])).toBe(true);
    expect(characterHasAnyExcludedTag(data, ["villain"])).toBe(false);
    expect(countIncludedTagMatches(data, ["mage", "winter", "villain"])).toBe(2);
  });
});

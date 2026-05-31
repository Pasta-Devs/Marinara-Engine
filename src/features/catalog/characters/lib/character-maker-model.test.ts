import { describe, expect, it } from "vitest";

import { characterLorebookContent, mergeTags, nameKeywords, parseTagsInput } from "./character-maker-model";

describe("character maker model helpers", () => {
  it("parses comma and newline separated tags with case-insensitive dedupe", () => {
    expect(parseTagsInput("Mage, scholar\nmage, slow burn, ")).toEqual(["Mage", "scholar", "slow burn"]);
  });

  it("merges generated and reference tags without duplicate keys", () => {
    expect(mergeTags(["Mage", "friendly", ""], ["mage", "library"])).toEqual(["Mage", "friendly", "library"]);
  });

  it("builds name keywords from full name and parts", () => {
    expect(nameKeywords("Rina Vale")).toEqual(["Rina Vale", "Rina", "Vale"]);
    expect(nameKeywords("  Rina  Rina ")).toEqual(["Rina  Rina", "Rina"]);
  });

  it("builds lorebook content only from populated fields", () => {
    expect(
      characterLorebookContent(
        {
          description: "Archivist",
          personality: "Careful",
          backstory: "",
          appearance: "Silver hair",
          scenario: "Old library",
        },
        "Rina",
      ),
    ).toBe(
      [
        "Name: Rina",
        "Description: Archivist",
        "Personality: Careful",
        "Appearance: Silver hair",
        "Scenario: Old library",
      ].join("\n\n"),
    );
  });
});

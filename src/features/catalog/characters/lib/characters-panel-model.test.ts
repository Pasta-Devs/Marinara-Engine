import { describe, expect, it } from "vitest";

import {
  collectCharacterTags,
  filterCharacterRows,
  getCharacterPreviewMetadata,
  parseCharacterGroups,
  parseCharacterRows,
  sortCharacterRows,
  UNGROUPED_CHARACTER_GROUP_ID,
  type CharacterRow,
} from "./characters-panel-model";

const rows: CharacterRow[] = [
  {
    id: "beta",
    data: { name: "Beta", tags: ["mage", "villain"], extensions: { fav: true } },
    createdAt: "2025-02-01",
  },
  {
    id: "alpha",
    data: { name: "Alpha", creator: "Xel", character_version: "1.2", tags: ["hero", "mage"], extensions: {} },
    createdAt: "2025-01-01",
  },
  {
    id: "gamma",
    data: {
      name: "Gamma",
      tags: ["rogue"],
      extensions: { importMetadata: { card: { spec: "chara_card_v2", specVersion: "2.0" } } },
    },
    createdAt: "2025-03-01",
  },
];

describe("characters panel model", () => {
  it("parses raw rows and builds preview metadata", () => {
    const parsed = parseCharacterRows(rows);

    expect(parsed[1]?.parsed.name).toBe("Alpha");
    expect(getCharacterPreviewMetadata(parsed[1]!)).toBe("by Xel · v1.2");
    expect(getCharacterPreviewMetadata(parsed[2]!)).toBe("chara_card_v2 · spec 2.0");
  });

  it("filters by favorites, included tags, and excluded tags", () => {
    const parsed = parseCharacterRows(rows);

    expect(
      filterCharacterRows({
        characters: parsed,
        favoriteFilter: "favorites",
        includedTags: new Set(),
        excludedTags: new Set(),
        searchExcludedTags: [],
      }).map((row) => row.id),
    ).toEqual(["beta"]);

    expect(
      filterCharacterRows({
        characters: parsed,
        favoriteFilter: "all",
        includedTags: new Set(["mage"]),
        excludedTags: new Set(["villain"]),
        searchExcludedTags: [],
      }).map((row) => row.id),
    ).toEqual(["alpha"]);
  });

  it("collects tags and sorts rows with included-tag ranking first", () => {
    const parsed = parseCharacterRows(rows);

    expect(collectCharacterTags(parsed)).toEqual(["hero", "mage", "rogue", "villain"]);
    expect(sortCharacterRows(parsed, "newest", new Set()).map((row) => row.id)).toEqual(["gamma", "beta", "alpha"]);
    expect(sortCharacterRows(parsed, "name-desc", new Set(["mage"])).map((row) => row.id)).toEqual([
      "beta",
      "alpha",
      "gamma",
    ]);
  });

  it("parses groups and appends synthetic ungrouped members", () => {
    const parsed = parseCharacterRows(rows);
    const groups = parseCharacterGroups([{ id: "party", name: "Party", characterIds: '["alpha"]' }], parsed);

    expect(groups[0]).toMatchObject({ id: "party", memberIds: ["alpha"] });
    expect(groups[1]).toMatchObject({
      id: UNGROUPED_CHARACTER_GROUP_ID,
      memberIds: ["beta", "gamma"],
      isSynthetic: true,
    });
  });
});

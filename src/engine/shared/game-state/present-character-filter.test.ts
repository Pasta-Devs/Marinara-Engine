import { describe, expect, it } from "vitest";
import { filterPlayerPersonaPresentCharacters } from "./present-character-filter";

describe("present character persona filtering", () => {
  it("filters macro rows even without a resolved persona", () => {
    expect(
      filterPlayerPersonaPresentCharacters([
        { characterId: "{{user}}", name: "{{user}}" },
        { characterId: "{{ userName }}", name: "User" },
      ]),
    ).toEqual([]);
  });

  it("filters exact active persona id and name matches", () => {
    const persona = { personaId: "persona-1", name: "Celia" };
    const rows = [
      { characterId: "persona-1", name: "Celia" },
      { characterId: "npc-1", name: "Ari" },
      { characterId: "manual-celia", name: "celia" },
    ];

    expect(filterPlayerPersonaPresentCharacters(rows, persona)).toEqual([{ characterId: "npc-1", name: "Ari" }]);
  });

  it("keeps ordinary user-like NPC names when no persona identity is known", () => {
    const rows = [{ characterId: "npc-user", name: "User" }];

    expect(filterPlayerPersonaPresentCharacters(rows)).toEqual(rows);
  });
});

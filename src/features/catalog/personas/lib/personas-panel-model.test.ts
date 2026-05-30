import { describe, expect, it } from "vitest";

import {
  filterPersonas,
  parsePersonaGroups,
  sortPersonas,
  type PersonaGroupRow,
  type PersonaPanelRow,
} from "./personas-panel-model";

function persona(overrides: Partial<PersonaPanelRow> & { id: string; name: string }): PersonaPanelRow {
  return {
    avatarPath: null,
    isActive: false,
    ...overrides,
  };
}

describe("personas panel model", () => {
  const personas = [
    persona({
      id: "persona-1",
      name: "Astra",
      description: "Starship pilot",
      comment: "Main",
      isActive: true,
      createdAt: "2026-01-03T00:00:00.000Z",
      tags: ["sci-fi", "pilot"],
    }),
    persona({
      id: "persona-2",
      name: "Briar",
      description: "Forest healer with a longer biography",
      comment: "Alt",
      isActive: "false",
      createdAt: "2026-01-01T00:00:00.000Z",
      tags: ["fantasy"],
    }),
    persona({
      id: "persona-3",
      name: "Cora",
      description: "Archivist",
      comment: "Reference",
      isActive: "true",
      createdAt: "2026-01-02T00:00:00.000Z",
      tags: ["fantasy", "scholar"],
    }),
  ];

  it("filters by active state, search text, and tag membership", () => {
    expect(
      filterPersonas({
        personas,
        activeFilter: "active",
        search: "",
        activeTag: null,
      }).map((row) => row.id),
    ).toEqual(["persona-1", "persona-3"]);

    expect(
      filterPersonas({
        personas,
        activeFilter: "all",
        search: "healer",
        activeTag: "fantasy",
      }).map((row) => row.id),
    ).toEqual(["persona-2"]);

    expect(
      filterPersonas({
        personas,
        activeFilter: "inactive",
        search: "pilot",
        activeTag: null,
      }),
    ).toEqual([]);
  });

  it("normalizes group member ids without mutating the source rows", () => {
    const groups: PersonaGroupRow[] = [
      { id: "group-1", name: "Party", description: "", personaIds: ["persona-1", "persona-2"] },
      { id: "group-2", name: "Empty", description: "", personaIds: [] },
    ];

    const parsed = parsePersonaGroups(groups);

    expect(parsed).toEqual([
      {
        id: "group-1",
        name: "Party",
        description: "",
        personaIds: ["persona-1", "persona-2"],
        memberIds: ["persona-1", "persona-2"],
      },
      {
        id: "group-2",
        name: "Empty",
        description: "",
        personaIds: [],
        memberIds: [],
      },
    ]);
    expect(parsed[0]?.memberIds).not.toBe(groups[0]?.personaIds);
  });

  it("sorts personas by name, creation date, and estimated token size", () => {
    expect(sortPersonas(personas, "name-asc").map((row) => row.id)).toEqual([
      "persona-1",
      "persona-2",
      "persona-3",
    ]);
    expect(sortPersonas(personas, "name-desc").map((row) => row.id)).toEqual([
      "persona-3",
      "persona-2",
      "persona-1",
    ]);
    expect(sortPersonas(personas, "newest").map((row) => row.id)).toEqual([
      "persona-1",
      "persona-3",
      "persona-2",
    ]);
    expect(sortPersonas(personas, "oldest").map((row) => row.id)).toEqual([
      "persona-2",
      "persona-3",
      "persona-1",
    ]);
    expect(sortPersonas(personas, "tokens").map((row) => row.id)[0]).toBe("persona-2");
  });
});

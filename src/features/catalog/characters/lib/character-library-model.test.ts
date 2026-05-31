import { describe, expect, it } from "vitest";

import {
  getCharacterMeta,
  getCharacterSections,
  getCharacterSummary,
  getText,
  gridColumnCount,
  parseCharacterRow,
  truncateText,
  type CharacterRow,
} from "./character-library-model";

const row: CharacterRow = {
  id: "char-1",
  data: {
    name: "Rina",
    creator: "Xel",
    character_version: "1.2",
    description: "Archivist",
    personality: "Careful",
    scenario: "",
    first_mes: "Welcome.",
    creator_notes: "Uses old archives.",
  },
  comment: "Fallback notes",
};

describe("character library model helpers", () => {
  it("parses character rows and prefers creator notes for summaries", () => {
    const parsed = parseCharacterRow(row);

    expect(parsed.parsed.name).toBe("Rina");
    expect(getCharacterSummary(parsed)).toBe("Uses old archives.");
    expect(getCharacterMeta(parsed)).toBe("Xel · v1.2");
  });

  it("falls back to comments and default summary text", () => {
    expect(getCharacterSummary(parseCharacterRow({ ...row, data: { name: "Rina" } }))).toBe("Fallback notes");
    expect(getCharacterSummary(parseCharacterRow({ ...row, data: { name: "Rina" }, comment: "" }))).toBe(
      "No creator notes yet.",
    );
  });

  it("normalizes text and truncates long snippets", () => {
    expect(getText("  hello  ")).toBe("hello");
    expect(getText(42)).toBe("");
    expect(truncateText("abcdefghij", 8)).toBe("abcde...");
    expect(truncateText("short", 8)).toBe("short");
  });

  it("builds detail sections only for populated content", () => {
    expect(getCharacterSections(parseCharacterRow(row)).map((section) => section.title)).toEqual([
      "Description",
      "Personality",
      "Opening Message",
    ]);
  });

  it("maps library width to stable column counts", () => {
    expect(gridColumnCount(1500)).toBe(4);
    expect(gridColumnCount(1200)).toBe(3);
    expect(gridColumnCount(700)).toBe(2);
    expect(gridColumnCount(320)).toBe(1);
  });
});

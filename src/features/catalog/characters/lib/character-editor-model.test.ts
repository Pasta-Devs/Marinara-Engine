import { describe, expect, it } from "vitest";
import type { CharacterCardVersion, CharacterData } from "../../../../engine/contracts/types/character";
import {
  getVersionFieldValue,
  getVersionTitle,
  normalizeAltDescriptions,
  normalizeCharacterEditorData,
} from "./character-editor-model";

describe("character editor model helpers", () => {
  it("normalizes description extensions from stored arrays and JSON strings", () => {
    expect(
      normalizeAltDescriptions([
        { id: "phase-1", label: "Phase 1", content: "Initial state", active: true },
        { label: "No id", content: 42, active: false },
        null,
      ]),
    ).toEqual([
      { id: "phase-1", label: "Phase 1", content: "Initial state", active: true },
      { id: "extension-1", label: "No id", content: "", active: false },
    ]);

    expect(normalizeAltDescriptions('[{"id":"json","content":"From JSON"}]')).toEqual([
      { id: "json", label: "Extension", content: "From JSON", active: true },
    ]);
    expect(normalizeAltDescriptions("not json")).toEqual([]);
  });

  it("applies character editor defaults without dropping recoverable extension data", () => {
    const normalized = normalizeCharacterEditorData({
      description: "Missing name but recoverable",
      extensions: { backstory: "Kept backstory" },
    } as CharacterData);

    expect(normalized?.description).toBe("Missing name but recoverable");
    expect(normalized?.extensions.backstory).toBe("Kept backstory");
    expect(normalized?.extensions.talkativeness).toBe(0.5);
    expect(normalized?.extensions.depth_prompt).toMatchObject({ prompt: "", depth: 4, role: "system" });
  });

  it("normalizes partial valid cards through the character schema", () => {
    const normalized = normalizeCharacterEditorData({ name: "Rina", description: "Archivist" } as CharacterData);

    expect(normalized?.name).toBe("Rina");
    expect(normalized?.personality).toBe("");
    expect(normalized?.alternate_greetings).toEqual([]);
    expect(normalized?.extensions.fav).toBe(false);
    expect(normalized?.character_book).toBeNull();
  });

  it("extracts comparable version fields without rendering object values", () => {
    const data = normalizeCharacterEditorData({
      name: "Rina",
      alternate_greetings: ["hello", "goodbye"],
      extensions: { backstory: "Archive childhood", appearance: "Silver hair" },
    } as CharacterData)!;

    expect(getVersionFieldValue(data, "extensions.backstory")).toBe("Archive childhood");
    expect(getVersionFieldValue(data, "extensions.appearance")).toBe("Silver hair");
    expect(getVersionFieldValue(data, "alternate_greetings")).toBe("hello, goodbye");
    expect(getVersionFieldValue(data, "character_book")).toBe("");
  });

  it("keeps version title fallback behavior stable", () => {
    expect(getVersionTitle({ version: "1.2" } as CharacterCardVersion)).toBe("v1.2");
    expect(getVersionTitle({ version: "   " } as CharacterCardVersion)).toBe("Untitled version");
  });
});

import { describe, expect, it } from "vitest";

import { buildPersonaSavePayload, type PersonaFormData } from "./persona-editor-model";

const baseFormData: PersonaFormData = {
  name: `Player "Alias"`,
  comment: `Comment "stays raw"`,
  description: `She says "hello".`,
  personality: `Keeps saying "focus".`,
  scenario: `"Ready?" she asks.`,
  backstory: `Raised around "old maps".`,
  appearance: `Wears a jacket called "Lucky".`,
  nameColor: "#ffffff",
  dialogueColor: "#111111",
  boxColor: "#222222",
  personaStats: null,
  altDescriptions: [
    { id: "combat", label: `Label "raw"`, content: `Draws the "silver blade".`, active: true },
    { id: "empty", label: "Empty", content: "", active: false },
  ],
  tags: [`tag "raw"`],
  avatarCrop: null,
};

describe("buildPersonaSavePayload", () => {
  it("applies typographic quote formatting to persona long-text fields and extension content", () => {
    const payload = buildPersonaSavePayload(baseFormData, "typographic");

    expect(payload.description).toBe("She says \u201chello\u201d.");
    expect(payload.personality).toBe("Keeps saying \u201cfocus\u201d.");
    expect(payload.scenario).toBe("\u201cReady?\u201d she asks.");
    expect(payload.backstory).toBe("Raised around \u201cold maps\u201d.");
    expect(payload.appearance).toBe("Wears a jacket called \u201cLucky\u201d.");
    expect(payload.altDescriptions[0]?.content).toBe("Draws the \u201csilver blade\u201d.");
  });

  it("leaves non-formatted metadata fields unchanged", () => {
    const payload = buildPersonaSavePayload(baseFormData, "typographic");

    expect(payload.name).toBe(baseFormData.name);
    expect(payload.comment).toBe(baseFormData.comment);
    expect(payload.tags).toEqual(baseFormData.tags);
    expect(payload.altDescriptions[0]?.label).toBe(baseFormData.altDescriptions[0]?.label);
  });

  it("can normalize typographic quotes back to straight quotes", () => {
    const payload = buildPersonaSavePayload(
      {
        ...baseFormData,
        description: "She says \u201chello\u201d.",
        altDescriptions: [{ id: "note", label: "Note", content: "Keeps \u201cfocus\u201d.", active: true }],
      },
      "straight",
    );

    expect(payload.description).toBe(`She says "hello".`);
    expect(payload.altDescriptions[0]?.content).toBe(`Keeps "focus".`);
  });
});

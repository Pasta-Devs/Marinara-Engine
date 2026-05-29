import { describe, expect, it } from "vitest";
import {
  createInputMacroResolverForChat,
  parseCharacterMacroData,
  resolveInputMacrosForChat,
  resolveMessageMacros,
} from "./chat-macros";

describe("chat macro character instruction fields", () => {
  it("plumbs parsed character instruction fields into message macro resolution", () => {
    const character = parseCharacterMacroData({
      id: "char-a",
      data: {
        name: "Aster",
        system_prompt: "Display system guidance.",
        post_history_instructions: "Display post-history guidance.",
      },
    });

    expect(character).not.toBeNull();
    expect(
      resolveMessageMacros("{{char}}|{{charSysInfo}}|{{charPostHistory}}", {
        primaryCharacter: character,
        characters: character ? [character] : [],
      }),
    ).toBe("Aster|Display system guidance.|Display post-history guidance.");
  });

  it("resolves input macros from chat character and persona rows", () => {
    const resolved = resolveInputMacrosForChat(
      "{{user}}|{{char}}|{{characters}}|{{input}}|{{persona}}",
      { characterIds: JSON.stringify(["char-b", "char-a"]), personaId: "persona-a" },
      [
        { id: "char-a", data: { name: "Aster" } },
        { id: "char-b", data: { name: "Basil" } },
      ],
      [{ id: "persona-a", name: "Mika", description: "Pilot persona" }],
      "hello there",
    );

    expect(resolved).toBe("Mika|Basil|Basil, Aster|hello there|Pilot persona");
  });

  it("keeps a per-submit input resolver stable if source rows change later", () => {
    const characterData = { name: "Aster", description: "Original character" };
    const persona = { id: "persona-a", name: "Mika", description: "Original persona" };
    const resolveInputMacros = createInputMacroResolverForChat(
      { characterIds: ["char-a"], personaId: "persona-a" },
      [{ id: "char-a", data: characterData }],
      [persona],
      "hello there",
    );

    characterData.name = "Changed";
    characterData.description = "Changed character";
    persona.name = "Changed";
    persona.description = "Changed persona";

    expect(resolveInputMacros("{{user}}|{{char}}|{{description}}|{{persona}}|{{input}}")).toBe(
      "Mika|Aster|Original character|Original persona|hello there",
    );
  });
});

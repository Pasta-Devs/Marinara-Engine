import { describe, expect, it } from "vitest";
import { parseCharacterMacroData, resolveInputMacrosForChat, resolveMessageMacros } from "./chat-macros";

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
});

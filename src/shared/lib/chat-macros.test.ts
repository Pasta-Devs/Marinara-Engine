import { describe, expect, it } from "vitest";
import { parseCharacterMacroData, resolveMessageMacros } from "./chat-macros";

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
});

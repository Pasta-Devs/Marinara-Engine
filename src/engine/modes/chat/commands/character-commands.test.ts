import { describe, expect, it } from "vitest";
import { parseCharacterCommands, parseDirectMessageCommands } from "./character-commands";

describe("parseCharacterCommands", () => {
  it("parses assistant numeric params with literal decimal points", () => {
    const { commands } = parseCharacterCommands(
      '[create_character: name="Ada", talkativeness=0.75, depth_prompt_depth=4]',
    );

    expect(commands).toEqual([
      expect.objectContaining({
        type: "create_character",
        name: "Ada",
        talkativeness: 0.75,
        depthPromptDepth: 4,
      }),
    ]);
  });

  it("does not parse malformed fractional numeric params", () => {
    const { commands } = parseCharacterCommands(
      '[create_character: name="Ada", talkativeness=0a5, depth_prompt_depth=4x2]',
    );

    expect(commands[0]).toMatchObject({ type: "create_character", name: "Ada" });
    expect(commands[0]).not.toHaveProperty("talkativeness");
    expect(commands[0]).not.toHaveProperty("depthPromptDepth");
  });
});

describe("parseDirectMessageCommands", () => {
  it("parses roleplay direct messages and strips transcript timestamps", () => {
    const result = parseDirectMessageCommands(
      'She checks her phone. [dm: character="Mira", message="[12:01] Meet me outside."]',
    );

    expect(result.cleanContent).toBe("She checks her phone.");
    expect(result.commands).toEqual([
      {
        type: "dm",
        character: "Mira",
        message: "Meet me outside.",
      },
    ]);
    expect(result.invalidCommands).toBe(0);
  });

  it("counts malformed direct-message commands that were stripped from output", () => {
    const result = parseDirectMessageCommands('[dm: character="Mira"]');

    expect(result.cleanContent).toBe("");
    expect(result.commands).toEqual([]);
    expect(result.invalidCommands).toBe(1);
  });
});

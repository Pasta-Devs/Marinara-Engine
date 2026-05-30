import { describe, expect, it } from "vitest";
import { parseCharacterCommands } from "./character-commands";

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

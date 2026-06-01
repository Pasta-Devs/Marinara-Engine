import { describe, expect, it, vi } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import {
  GAME_BACKGROUND_PROMPT_OVERRIDE,
  PROMPT_OVERRIDE_REGISTRY,
  loadRegisteredPrompt,
  validatePromptOverrideTemplate,
} from "./prompt-overrides";

describe("prompt override registry", () => {
  it("registers supported conversation, sprite, and game prompt override keys", () => {
    expect(PROMPT_OVERRIDE_REGISTRY.map((definition) => definition.key)).toEqual([
      "conversation.selfie",
      "sprite.portraitSingle",
      "sprite.expressionSheet",
      "sprite.fullBodySingle",
      "sprite.fullBodySheet",
      "sprite.fullBodyExpressionSheet",
      "game.background",
      "game.illustration",
      "game.portrait",
    ]);
  });

  it("rejects variables outside a registered schema", () => {
    expect(validatePromptOverrideTemplate("Wrap ${defaultPrompt} with ${missing}", ["defaultPrompt"])).toEqual({
      valid: false,
      unknownVariables: ["missing"],
    });
  });

  it("renders registered image overrides with defaultPrompt context", async () => {
    const storage = {
      get: vi.fn(async (_collection: string, id: string) => ({
        id,
        key: id,
        template: "CUSTOM ${label}: ${defaultPrompt}",
        enabled: true,
      })),
    } as Partial<StorageGateway> as StorageGateway;

    await expect(
      loadRegisteredPrompt(storage, GAME_BACKGROUND_PROMPT_OVERRIDE, {
        defaultPrompt: "Wide establishing background of a harbor.",
        label: "harbor",
        detail: "harbor at dawn",
        artStyle: "painted fantasy",
        format: "descriptive",
      }),
    ).resolves.toBe("CUSTOM harbor: Wide establishing background of a harbor.");
  });
});

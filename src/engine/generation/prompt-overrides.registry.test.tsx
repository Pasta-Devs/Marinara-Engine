import { describe, expect, it, vi } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import {
  GAME_BACKGROUND_PROMPT_OVERRIDE,
  PROMPT_OVERRIDE_COLLECTION,
  PROMPT_OVERRIDE_REGISTRY,
  loadRegisteredPrompt,
  validatePromptOverrideTemplate,
} from "./prompt-overrides";

const backgroundContext = {
  defaultPrompt: "Wide establishing background of a harbor.",
  label: "harbor",
  detail: "harbor at dawn",
  artStyle: "painted fantasy",
  format: "descriptive",
};

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

  it("accepts valid templates and static prompt text", () => {
    expect(validatePromptOverrideTemplate("${label}: ${defaultPrompt}", ["label", "defaultPrompt"])).toEqual({
      valid: true,
      unknownVariables: [],
    });
    expect(validatePromptOverrideTemplate("Static prompt text", [])).toEqual({
      valid: true,
      unknownVariables: [],
    });
  });

  it("reports malformed and repeated unknown variables once", () => {
    expect(
      validatePromptOverrideTemplate(
        "Bad ${} ${missing} ${missing} ${other} ${unterminated",
        ["defaultPrompt"],
      ),
    ).toEqual({
      valid: false,
      unknownVariables: ["<empty>", "missing", "other", "unterminated"],
    });
  });

  it("renders registered image overrides with defaultPrompt context", async () => {
    const storage = {
      get: vi.fn(async (collection: string, id: string) => {
        expect(collection).toBe(PROMPT_OVERRIDE_COLLECTION);
        return {
          id,
          key: id,
          template: "CUSTOM ${label}: ${defaultPrompt}",
          enabled: true,
        };
      }),
    } as Partial<StorageGateway> as StorageGateway;

    await expect(loadRegisteredPrompt(storage, GAME_BACKGROUND_PROMPT_OVERRIDE, backgroundContext)).resolves.toBe(
      "CUSTOM harbor: Wide establishing background of a harbor.",
    );
  });

  it("falls back to default builder when the registered override is disabled", async () => {
    const storage = {
      get: vi.fn(async () => ({
        id: "game.background",
        key: "game.background",
        template: "CUSTOM ${label}: ${defaultPrompt}",
        enabled: false,
      })),
    } as Partial<StorageGateway> as StorageGateway;

    await expect(loadRegisteredPrompt(storage, GAME_BACKGROUND_PROMPT_OVERRIDE, backgroundContext)).resolves.toBe(
      backgroundContext.defaultPrompt,
    );
  });

  it("falls back to default builder when the registered override has unknown variables", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = {
      get: vi.fn(async () => ({
        id: "game.background",
        key: "game.background",
        template: "CUSTOM ${unknownVar}: ${defaultPrompt}",
        enabled: true,
      })),
    } as Partial<StorageGateway> as StorageGateway;

    try {
      await expect(loadRegisteredPrompt(storage, GAME_BACKGROUND_PROMPT_OVERRIDE, backgroundContext)).resolves.toBe(
        backgroundContext.defaultPrompt,
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown variables: unknownVar"));
    } finally {
      warn.mockRestore();
    }
  });

  it("falls back to default builder when override storage throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = {
      get: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
    } as Partial<StorageGateway> as StorageGateway;

    try {
      await expect(loadRegisteredPrompt(storage, GAME_BACKGROUND_PROMPT_OVERRIDE, backgroundContext)).resolves.toBe(
        backgroundContext.defaultPrompt,
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Falling back to default for game.background"), expect.any(Error));
    } finally {
      warn.mockRestore();
    }
  });
});

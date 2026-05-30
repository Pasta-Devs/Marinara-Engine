import { describe, expect, it } from "vitest";
import { updatePromptPresetSchema } from "./prompt.schema";

describe("prompt schemas", () => {
  it("accepts preset variable order updates", () => {
    const parsed = updatePromptPresetSchema.parse({ variableOrder: ["choice-a", "choice-b"] });

    expect(parsed).toEqual({ variableOrder: ["choice-a", "choice-b"] });
  });

  it("accepts default preset flag updates", () => {
    const parsed = updatePromptPresetSchema.parse({ isDefault: true, default: true });

    expect(parsed).toEqual({ isDefault: true, default: true });
  });
});

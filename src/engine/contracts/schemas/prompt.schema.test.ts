import { describe, expect, it } from "vitest";
import { updatePromptPresetSchema } from "./prompt.schema";

describe("prompt schemas", () => {
  it("accepts preset variable order updates", () => {
    const parsed = updatePromptPresetSchema.parse({ variableOrder: ["choice-a", "choice-b"] });

    expect(parsed).toEqual({ variableOrder: ["choice-a", "choice-b"] });
  });

  it("accepts default preset flag updates", () => {
    const parsed = updatePromptPresetSchema.parse({ isDefault: true, default: true });

    expect(parsed).toEqual({ isDefault: true });
  });

  it("normalizes the legacy default flag to isDefault", () => {
    const parsed = updatePromptPresetSchema.parse({ default: true });

    expect(parsed).toEqual({ isDefault: true });
  });

  it("rejects conflicting default preset flags", () => {
    expect(() => updatePromptPresetSchema.parse({ isDefault: false, default: true })).toThrow();
  });

  it("rejects malformed preset update fields", () => {
    expect(() => updatePromptPresetSchema.parse({ variableOrder: "not-array" })).toThrow();
    expect(() => updatePromptPresetSchema.parse({ variableOrder: [123] })).toThrow();
    expect(() => updatePromptPresetSchema.parse({ isDefault: "yes" })).toThrow();
  });
});

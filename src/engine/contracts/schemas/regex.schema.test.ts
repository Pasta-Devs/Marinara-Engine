import { describe, expect, it } from "vitest";
import { updateRegexScriptSchema } from "./regex.schema";

describe("regex schemas", () => {
  it("accepts reorder patches without filling defaults", () => {
    const parsed = updateRegexScriptSchema.parse({ order: 2, sortOrder: 2 });

    expect(parsed).toEqual({ order: 2, sortOrder: 2 });
  });

  it("rejects malformed reorder fields", () => {
    for (const value of [1.5, "2", null, {}, []]) {
      expect(updateRegexScriptSchema.safeParse({ order: value }).success).toBe(false);
      expect(updateRegexScriptSchema.safeParse({ sortOrder: value }).success).toBe(false);
    }
    expect(() => updateRegexScriptSchema.parse({ sortOrder: Number.NaN })).toThrow();
  });
});

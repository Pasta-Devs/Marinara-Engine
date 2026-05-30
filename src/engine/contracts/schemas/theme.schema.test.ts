import { describe, expect, it } from "vitest";
import { updateThemeSchema } from "./theme.schema";

describe("theme schemas", () => {
  it("accepts active theme flag updates", () => {
    const parsed = updateThemeSchema.parse({ isActive: true, active: true });

    expect(parsed).toEqual({ isActive: true, active: true });
  });

  it("rejects non-boolean active flags", () => {
    for (const value of ["true", 1, null, [], {}]) {
      expect(updateThemeSchema.safeParse({ isActive: value }).success).toBe(false);
      expect(updateThemeSchema.safeParse({ active: value }).success).toBe(false);
    }
    expect(() => updateThemeSchema.parse({ isActive: "true" })).toThrow();
  });
});

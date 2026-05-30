import { describe, expect, it } from "vitest";
import { updateThemeSchema } from "./theme.schema";

describe("theme schemas", () => {
  it("accepts active theme flag updates", () => {
    const parsed = updateThemeSchema.parse({ isActive: true, active: true });

    expect(parsed).toEqual({ isActive: true, active: true });
  });
});

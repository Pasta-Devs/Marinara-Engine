import { describe, expect, it } from "vitest";
import { createLorebookSchema, updateLorebookSchema } from "./lorebook.schema";

describe("lorebook schemas", () => {
  it("defaults new lorebooks to vectorization enabled", () => {
    const parsed = createLorebookSchema.parse({ name: "World Book" });

    expect(parsed.excludeFromVectorization).toBe(false);
  });

  it("accepts lorebook-level vectorization exclusion updates", () => {
    const parsed = updateLorebookSchema.parse({ excludeFromVectorization: true });

    expect(parsed.excludeFromVectorization).toBe(true);
  });
});

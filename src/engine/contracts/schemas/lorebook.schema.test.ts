import { describe, expect, it } from "vitest";
import { createLorebookSchema, updateLorebookEntrySchema, updateLorebookSchema } from "./lorebook.schema";

describe("lorebook schemas", () => {
  it("defaults new lorebooks to vectorization enabled", () => {
    const parsed = createLorebookSchema.parse({ name: "World Book" });

    expect(parsed.excludeFromVectorization).toBe(false);
  });

  it("accepts lorebook-level vectorization exclusion updates", () => {
    const parsed = updateLorebookSchema.parse({ excludeFromVectorization: true });

    expect(parsed.excludeFromVectorization).toBe(true);
  });

  it("accepts moving an entry between lorebooks as a narrow patch", () => {
    const parsed = updateLorebookEntrySchema.parse({ lorebookId: "lorebook-next" });

    expect(parsed).toEqual({ lorebookId: "lorebook-next" });
  });

  it("accepts game-session lorebook metadata", () => {
    const parsed = createLorebookSchema.parse({
      name: "Game Session Lore",
      category: "game",
      generatedBy: "game-session",
    });

    expect(parsed.category).toBe("game");
    expect(parsed.generatedBy).toBe("game-session");
  });
});

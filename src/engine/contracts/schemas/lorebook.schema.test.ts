import { describe, expect, it } from "vitest";
import {
  createLorebookEntrySchema,
  createLorebookFolderSchema,
  createLorebookSchema,
  updateLorebookEntrySchema,
  updateLorebookFolderSchema,
  updateLorebookSchema,
} from "./lorebook.schema";

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

  it("accepts display-order and embedding patches without filling defaults", () => {
    const parsed = updateLorebookEntrySchema.parse({ sortOrder: 4, order: 4, embedding: null });

    expect(parsed).toEqual({ sortOrder: 4, order: 4, embedding: null });
  });

  it("strips system-managed fields from copied entries", () => {
    const parsed = createLorebookEntrySchema.parse({
      id: "entry-original",
      lorebookId: "lorebook-copy",
      name: "Copied",
      sortOrder: 2,
      embedding: [0.1, 0.2],
      createdAt: "old",
      updatedAt: "old",
    });

    expect(parsed).toMatchObject({
      lorebookId: "lorebook-copy",
      name: "Copied",
      sortOrder: 2,
      embedding: [0.1, 0.2],
    });
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("createdAt");
    expect(parsed).not.toHaveProperty("updatedAt");
  });

  it("accepts folder sort-order patches without filling defaults", () => {
    const parsed = updateLorebookFolderSchema.parse({ order: 1, sortOrder: 1 });

    expect(parsed).toEqual({ order: 1, sortOrder: 1 });
  });

  it("requires folder creates to carry their parent lorebook id", () => {
    const parsed = createLorebookFolderSchema.parse({ lorebookId: "lorebook-1", name: "Locations" });

    expect(parsed.lorebookId).toBe("lorebook-1");
  });

  it("rejects invalid lorebook category and generatedBy values", () => {
    expect(() => createLorebookSchema.parse({ name: "Invalid", category: "invalid-category" })).toThrow();
    expect(() => createLorebookSchema.parse({ name: "Invalid", generatedBy: "unknown-maker" })).toThrow();
  });

  it("rejects malformed lorebook entry metadata", () => {
    expect(() => updateLorebookEntrySchema.parse({ embedding: "not-an-array" })).toThrow();
    expect(() => updateLorebookEntrySchema.parse({ embedding: [1, "2"] })).toThrow();
    expect(() => updateLorebookEntrySchema.parse({ sortOrder: 1.5 })).toThrow();
    expect(() => createLorebookEntrySchema.parse({ lorebookId: "book", name: "" })).toThrow();
  });

  it("rejects folder creates without a valid lorebook id", () => {
    expect(() => createLorebookFolderSchema.parse({ name: "Missing Parent" })).toThrow();
    expect(() => createLorebookFolderSchema.parse({ lorebookId: 123, name: "Bad Parent" })).toThrow();
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
